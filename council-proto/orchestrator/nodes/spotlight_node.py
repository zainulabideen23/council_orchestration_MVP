"""
spotlight_node — separate subgraph for direct agent queries.
Leader is bypassed entirely. Returns the agent's complete unfiltered response.
"""

import os
from model_wrapper import call_model
from context_builder import build_spotlight_context
from db import load_project_state, load_agent
from callbacks import emit_event

SPOTLIGHT_MODEL = os.getenv('COUNCIL_DEFAULT_MODEL', 'mistralai/mistral-large')


async def spotlight_execute(project_id: str, agent_id: str, query: str) -> dict:
    data = load_project_state(project_id)

    agent = load_agent(agent_id)
    if not agent:
        return {'error': 'Agent not found'}

    running_brief = data['running_brief']
    previous_round = data['previous_round']

    await emit_event('agent:thinking', {
        'agentId': agent_id, 'agentName': agent['name'],
        'projectId': project_id, 'roundId': '',
    })

    messages = build_spotlight_context(
        agent=agent,
        spotlight_query=query,
        previous_round=previous_round,
        running_brief=running_brief,
    )

    result = await call_model(
        messages=messages,
        model=SPOTLIGHT_MODEL,
    )

    content = result['content']
    if content.startswith('[ERROR:') or content.startswith('[TIMEOUT'):
        await emit_event('agent:complete', {
            'agentId': agent_id, 'agentName': agent['name'],
            'projectId': project_id, 'roundId': '',
            'error': True, 'latencyMs': result['latency_ms'],
            'tokensUsed': result['tokens_used'],
            'response': content,
        })
        return {'error': content}

    await emit_event('agent:complete', {
        'agentId': agent_id, 'agentName': agent['name'],
        'projectId': project_id, 'roundId': '',
        'error': False, 'latencyMs': result['latency_ms'],
        'tokensUsed': result['tokens_used'],
        'response': content[:500],
    })

    return {
        'agentName': agent['name'],
        'response': content,
        'tokensUsed': result['tokens_used'],
        'latencyMs': result['latency_ms'],
    }
