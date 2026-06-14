"""
FastAPI server — entry point for the LangGraph orchestrator.
Node.js POSTs here to execute rounds and spotlight queries.
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from graph import round_graph
from db import (
    load_project_state,
    create_round,
    update_round_status,
    increment_rounds_done,
    close as close_db,
)
from nodes.spotlight_node import spotlight_execute
from callbacks import emit_event

app = FastAPI(title='Council Orchestrator', version='0.1')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv('CLIENT_ORIGIN', 'http://localhost:5173'), 'http://localhost:3001'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class RoundRequest(BaseModel):
    projectId: str


class SpotlightRequest(BaseModel):
    projectId: str
    agentId: str
    query: str


@app.post('/execute-round')
async def execute_round(req: RoundRequest):
    project_id = req.projectId

    try:
        state_data = load_project_state(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'DB error: {e}')

    project = state_data['project']
    stage = state_data['stage']

    if project['status'] != 'RUNNING':
        raise HTTPException(status_code=400, detail='Project is not RUNNING')
    if not stage:
        raise HTTPException(status_code=400, detail='No active stage')

    stage_id = stage['id']
    round_number = stage['roundsDone'] + 1

    try:
        round_id, actual_round_number = create_round(stage_id, round_number, project['query'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to create round: {e}')

    await emit_event('round:started', {
        'roundId': round_id,
        'roundNumber': actual_round_number,
        'projectId': project_id,
        'stageId': stage_id,
    })

    initial_state = {
        'project_id': project_id,
        'stage_id': stage_id,
        'round_id': round_id,
        'round_number': round_number,
        'order_index': stage['orderIndex'],
        'stage_status': stage['status'],
        'rounds_done': stage['roundsDone'],
        'rounds_total': stage['roundsTotal'],
        'error': None,
        'query': project['query'],
        'council_agents': state_data['council_agents'],
        'previous_round': state_data['previous_round'],
        'running_brief': state_data['running_brief'],
        'agent_responses': [],
        'all_agents_ok': False,
        'has_any_response': False,
        'updated_brief': state_data['running_brief'],
        'summarizer_ok': False,
        'leader_synthesis': '',
        'leader_ok': False,
        'stage_complete': False,
        'project_complete': False,
        'transition_ok': False,
        'transition_error': None,
        'next_stage_id': None,
        'next_stage_name': None,
    }

    try:
        result = await round_graph.ainvoke(initial_state)
    except Exception as e:
        update_round_status(round_id, 'FAILED')
        await emit_event('round:failed', {'roundId': round_id, 'error': str(e)})
        raise HTTPException(status_code=500, detail=f'Round execution failed: {e}')

    round_status = 'COMPLETE' if result.get('has_any_response', False) else 'FAILED'
    update_round_status(round_id, round_status)
    if round_status == 'COMPLETE':
        increment_rounds_done(stage_id)

    return {
        'roundId': round_id,
        'roundNumber': actual_round_number,
        'status': round_status,
        'agentResponses': result.get('agent_responses', []),
        'updatedBrief': result.get('updated_brief', ''),
        'leaderSynthesis': result.get('leader_synthesis', ''),
        'stageComplete': result.get('stage_complete', False),
        'projectComplete': result.get('project_complete', False),
        'nextStageName': result.get('next_stage_name'),
    }


@app.post('/spotlight')
async def spotlight(req: SpotlightRequest):
    try:
        result = await spotlight_execute(req.projectId, req.agentId, req.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])

    return result


@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.on_event('shutdown')
async def shutdown():
    close_db()
