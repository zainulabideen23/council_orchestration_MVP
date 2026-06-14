"""
transition_node — checks if stage is complete and executes transition.
"""

import asyncio
from db import (
    update_stage_status,
    get_next_stage,
    update_project_stage,
    update_project_status,
    promote_on_deck_to_council,
    get_bunkhouse_agents_for_promotion,
    update_agent_seat,
    save_minimal_briefing,
)
from model_wrapper import call_model
from context_builder import build_bunkhouse_promotion_context
from callbacks import emit_event


def transition_check(state: dict) -> str:
    """Conditional edge: 'transition' if rounds complete, 'end' if not.
    Only transitions if the current round had at least one successful response.
    """
    stage_status = state.get('stage_status', 'ACTIVE')

    if stage_status == 'COMPLETE':
        return 'end'

    if not state.get('has_any_response', False):
        return 'end'

    rounds_total = state.get('rounds_total', 3)

    from db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM "Round" WHERE "stageId" = %s AND status = %s',
                (state['stage_id'], 'COMPLETE'))
    rounds_done = cur.fetchone()[0]
    cur.close()

    if rounds_done + 1 >= rounds_total:
        return 'transition'
    return 'end'


async def transition_execute_node(state: dict) -> dict:
    """Execute stage transition: increment rounds, update status, promote agents."""
    stage_id = state['stage_id']
    project_id = state['project_id']
    round_id = state.get('round_id', '')
    running_brief = state.get('updated_brief', state.get('running_brief', ''))

    rounds_done = state.get('rounds_done', 0) + 1
    rounds_total = state.get('rounds_total', 3)

    if rounds_done < rounds_total:
        update_stage_status(stage_id, 'ACTIVE')
        return {
            'stage_complete': False,
            'project_complete': False,
            'transition_ok': True,
            'rounds_done': rounds_done,
        }

    update_stage_status(stage_id, 'COMPLETE')

    next_stage = get_next_stage(project_id, state.get('order_index', 1))
    if not next_stage:
        update_project_stage(project_id, None)
        update_project_status(project_id, 'COMPLETE')
        await emit_event('project:complete', {
            'projectId': project_id,
            'roundId': round_id,
        })
        return {
            'stage_complete': True,
            'project_complete': True,
            'transition_ok': True,
            'rounds_done': rounds_done,
        }

    update_project_stage(project_id, next_stage['id'])
    update_stage_status(next_stage['id'], 'ACTIVE')

    from db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT name FROM "Stage" WHERE id = %s', (stage_id,))
    from_name = cur.fetchone()[0]
    cur.execute("""
        SELECT a.name FROM "StageCouncil" sc
        JOIN "Agent" a ON a.id = sc."agentId"
        WHERE sc."stageId" = %s AND sc."seatType" = 'ON_DECK'
    """, (next_stage['id'],))
    ondeck_names = [r[0] for r in cur.fetchall()]
    cur.close()

    promote_on_deck_to_council(next_stage['id'])
    bunkhouse_agents = get_bunkhouse_agents_for_promotion(next_stage['id'])
    bunkhouse_names = [a['name'] for a in bunkhouse_agents]

    await emit_event('stage:transition', {
        'projectId': project_id,
        'roundId': round_id,
        'fromStageId': stage_id,
        'fromStageName': from_name,
        'toStageId': next_stage['id'],
        'toStageName': next_stage['name'],
        'promotedOnDeck': ondeck_names,
        'promotedBunkhouse': bunkhouse_names,
    })

    async def promote_one(agent):
        try:
            context = build_bunkhouse_promotion_context(
                agent, running_brief, next_stage['name']
            )
            result = await call_model(
                messages=context,
                model=agent['model'],
            )
            briefing = result['content']
            if not briefing.startswith('[ERROR'):
                save_minimal_briefing(next_stage['id'], agent['id'], briefing)
            update_agent_seat(agent['id'], 'COUNCIL')
        except Exception as e:
            print(f'  [transition] bunkhouse promotion failed for {agent["name"]}: {e}')

    if bunkhouse_agents:
        await asyncio.gather(*(promote_one(a) for a in bunkhouse_agents))

    return {
        'stage_complete': True,
        'project_complete': False,
        'transition_ok': True,
        'rounds_done': rounds_done,
        'next_stage_id': next_stage['id'],
        'next_stage_name': next_stage['name'],
    }
