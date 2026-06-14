"""
Database access layer for the LangGraph orchestrator.
Direct PostgreSQL access matching the Prisma schema.
All table names are quoted to match Prisma's exact casing.
"""

import os
from datetime import datetime, timezone
from typing import Optional
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/council_proto')

_conn = None

def get_conn():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(DATABASE_URL)
        _conn.autocommit = False
    try:
        cur = _conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
    except Exception:
        _conn.rollback()
    return _conn

def close():
    global _conn
    if _conn and not _conn.closed:
        _conn.close()
        _conn = None

# --- Project state ---

def load_project_state(project_id: str) -> dict:
    """Load project, active stage, council agents, running brief, previous round."""
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute('SELECT * FROM "Project" WHERE id = %s', (project_id,))
        project = cur.fetchone()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        cur.execute('SELECT * FROM "Stage" WHERE id = %s', (project['currentStageId'],))
        stage = cur.fetchone()

        council_agents = []
        if stage:
            cur.execute("""
                SELECT a.id, a.name, a."personaPrompt", a.model, sc."seatType"
                FROM "StageCouncil" sc
                JOIN "Agent" a ON a.id = sc."agentId"
                WHERE sc."stageId" = %s AND sc."seatType" = 'COUNCIL'
            """, (stage['id'],))
            council_agents = [dict(r) for r in cur.fetchall()]

        cur.execute('SELECT * FROM "RunningBrief" WHERE "projectId" = %s', (project_id,))
        brief = cur.fetchone()

        previous_round = []
        if stage:
            cur.execute('SELECT id FROM "Round" WHERE "stageId" = %s AND status = %s ORDER BY "roundNumber" DESC LIMIT 1',
                        (stage['id'], 'COMPLETE'))
            prev_round = cur.fetchone()
            if prev_round:
                cur.execute("""
                    SELECT a.name, ar.response
                    FROM "AgentResponse" ar
                    JOIN "Agent" a ON a.id = ar."agentId"
                    WHERE ar."roundId" = %s
                """, (prev_round['id'],))
                previous_round = [dict(r) for r in cur.fetchall()]

    return {
        'project': dict(project),
        'stage': dict(stage) if stage else None,
        'council_agents': council_agents,
        'running_brief': brief['content'] if brief else '',
        'previous_round': previous_round,
    }

# --- Round lifecycle ---

def create_round(stage_id: str, round_number: int, query: str) -> tuple:
    """Create a round and return (round_id, actual_round_number)."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            'SELECT COALESCE(MAX("roundNumber"), 0) + 1 FROM "Round" WHERE "stageId" = %s',
            (stage_id,)
        )
        next_number = cur.fetchone()[0]
        use_number = max(round_number, next_number)
        cur.execute(
            'INSERT INTO "Round" (id, "stageId", "roundNumber", status, query, "createdAt") '
            'VALUES (gen_random_uuid(), %s, %s, %s, %s, %s) RETURNING id',
            (stage_id, use_number, 'RUNNING', query, datetime.now(timezone.utc))
        )
        round_id = cur.fetchone()[0]
        conn.commit()
    return (round_id, use_number)

def update_round_status(round_id: str, status: str):
    conn = get_conn()
    with conn.cursor() as cur:
        if status in ('COMPLETE', 'FAILED'):
            cur.execute(
                'UPDATE "Round" SET status = %s, "completedAt" = %s WHERE id = %s',
                (status, datetime.now(timezone.utc), round_id)
            )
        else:
            cur.execute('UPDATE "Round" SET status = %s WHERE id = %s', (status, round_id))
        conn.commit()

def save_agent_response(round_id: str, agent_id: str, response: str, tokens_used: Optional[int], latency_ms: Optional[int]):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AgentResponse" (id, "roundId", "agentId", response, "tokensUsed", "latencyMs", "createdAt") '
            'VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s) ON CONFLICT ("roundId", "agentId") DO NOTHING',
            (round_id, agent_id, response, tokens_used, latency_ms, datetime.now(timezone.utc))
        )
        conn.commit()

# --- Running brief ---

def save_leader_synthesis(round_id: str, synthesis: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "Round" SET synthesis = %s WHERE id = %s',
            (synthesis, round_id)
        )
        conn.commit()

def update_running_brief(project_id: str, content: str, round_count: int):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "RunningBrief" (id, "projectId", content, "roundCount", "updatedAt") '
            'VALUES (gen_random_uuid(), %s, %s, %s, %s) '
            'ON CONFLICT ("projectId") DO UPDATE SET content = %s, "roundCount" = %s, "updatedAt" = %s',
            (project_id, content, round_count, datetime.now(timezone.utc),
             content, round_count, datetime.now(timezone.utc))
        )
        conn.commit()

# --- Stage transitions ---

def increment_rounds_done(stage_id: str) -> int:
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "Stage" SET "roundsDone" = "roundsDone" + 1 WHERE id = %s RETURNING "roundsDone", "roundsTotal"',
            (stage_id,)
        )
        row = cur.fetchone()
        conn.commit()
        return {'rounds_done': row[0], 'rounds_total': row[1]}

def update_stage_status(stage_id: str, status: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('UPDATE "Stage" SET status = %s WHERE id = %s', (status, stage_id))
        conn.commit()

def get_next_stage(project_id: str, current_order: int) -> Optional[dict]:
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            'SELECT * FROM "Stage" WHERE "projectId" = %s AND "orderIndex" = %s',
            (project_id, current_order + 1)
        )
        return cur.fetchone()

def update_project_stage(project_id: str, stage_id: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('UPDATE "Project" SET "currentStageId" = %s WHERE id = %s', (stage_id, project_id))
        conn.commit()

def update_project_status(project_id: str, status: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('UPDATE "Project" SET status = %s WHERE id = %s', (status, project_id))
        conn.commit()

def promote_on_deck_to_council(stage_id: str):
    """Move ON_DECK agents to COUNCIL for the given stage."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "StageCouncil" SET "seatType" = %s WHERE "stageId" = %s AND "seatType" = %s',
            ('COUNCIL', stage_id, 'ON_DECK')
        )
        conn.commit()

def get_bunkhouse_agents_for_promotion(stage_id: str):
    """Get Bunkhouse agents who are assigned as COUNCIL for this stage."""
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT a.id, a.name, a."personaPrompt", a.model
            FROM "StageCouncil" sc
            JOIN "Agent" a ON a.id = sc."agentId"
            WHERE sc."stageId" = %s AND sc."seatType" = 'COUNCIL'
            AND a.seat = 'BUNKHOUSE'
        """, (stage_id,))
        return [dict(r) for r in cur.fetchall()]

def update_agent_seat(agent_id: str, seat: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute('UPDATE "Agent" SET seat = %s WHERE id = %s', (seat, agent_id))
        conn.commit()

def save_minimal_briefing(stage_id: str, agent_id: str, briefing: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "StageCouncil" SET "minimalBriefing" = %s WHERE "stageId" = %s AND "agentId" = %s',
            (briefing, stage_id, agent_id)
        )
        conn.commit()

# --- Spotlight ---

def load_agent(agent_id: str) -> Optional[dict]:
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute('SELECT * FROM "Agent" WHERE id = %s', (agent_id,))
        row = cur.fetchone()
        return dict(row) if row else None
