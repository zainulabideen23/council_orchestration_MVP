"""
leader_node — calls leader model to synthesise all agent responses.
Emits real-time events during execution.
"""

import os
from model_wrapper import call_model
from context_builder import build_leader_context
from db import save_leader_synthesis
from callbacks import emit_event

LEADER_MODEL = os.getenv('LEADER_MODEL', 'mistralai/mistral-large')


async def leader_node(state: dict) -> dict:
    query = state.get('query', '')
    project_id = state.get('project_id', '')
    round_id = state.get('round_id', '')
    updated_brief = state.get('updated_brief', state.get('running_brief', ''))

    await emit_event('leader:running', {
        'projectId': project_id,
        'roundId': round_id,
    })

    messages = build_leader_context(query, updated_brief)

    result = await call_model(
        messages=messages,
        model=LEADER_MODEL,
    )

    content = result['content']

    if content.startswith('[ERROR:') or content.startswith('[TIMEOUT'):
        print(f'  [leader] failed — returning placeholder: {content[:80]}')
        placeholder = (
            '## Synthesis Unavailable\n\n'
            'The Leader was unable to process this round. '
            'Agent responses are still stored and available for review.'
        )
        await emit_event('leader:complete', {
            'projectId': project_id,
            'roundId': round_id,
            'error': True,
            'synthesis': '',
        })
        return {'leader_synthesis': placeholder, 'leader_ok': False}

    try:
        save_leader_synthesis(round_id, content)
    except Exception as e:
        print(f'  [leader] DB write failed: {e}')

    await emit_event('leader:complete', {
        'projectId': project_id,
        'roundId': round_id,
        'error': False,
        'synthesis': content[:500],
    })

    return {'leader_synthesis': content, 'leader_ok': True}
