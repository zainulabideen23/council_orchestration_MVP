"""
council_node — fires all Council agents in parallel via asyncio.gather.
Emits real-time events for each agent as they complete.
"""

import asyncio
import time
from model_wrapper import call_model
from context_builder import build_council_context
from db import save_agent_response
from callbacks import emit_event


async def council_agents_node(state: dict) -> dict:
    agents = state.get('council_agents', [])
    query = state['query']
    previous_round = state.get('previous_round', [])
    running_brief = state.get('running_brief', '')
    round_id = state['round_id']
    project_id = state.get('project_id', '')

    if not agents:
        return {'agent_responses': [], 'all_agents_ok': False}

    async def call_single_agent(agent: dict) -> dict:
        await emit_event('agent:thinking', {
            'agentId': agent['id'],
            'agentName': agent['name'],
            'projectId': project_id,
            'roundId': round_id,
        })

        start = time.monotonic()
        messages = build_council_context(agent, query, previous_round, running_brief)
        result = await call_model(
            messages=messages,
            model=agent['model'],
        )
        latency = int((time.monotonic() - start) * 1000)

        response_text = result['content']
        tokens = result['tokens_used']

        is_error = response_text.startswith('[ERROR:') or response_text.startswith('[TIMEOUT')

        if not is_error:
            try:
                save_agent_response(
                    round_id=round_id,
                    agent_id=agent['id'],
                    response=response_text,
                    tokens_used=tokens,
                    latency_ms=latency,
                )
            except Exception as e:
                response_text = f'[DB_ERROR: {e}]'
                is_error = True

        await emit_event('agent:complete', {
            'agentId': agent['id'],
            'agentName': agent['name'],
            'projectId': project_id,
            'roundId': round_id,
            'error': is_error,
            'latencyMs': latency,
            'tokensUsed': tokens,
            'response': response_text[:500] if not is_error else response_text,
        })

        return {
            'agentId': agent['id'],
            'agentName': agent['name'],
            'response': response_text,
            'latencyMs': latency,
            'tokensUsed': tokens,
            'error': is_error,
        }

    async def call_with_stagger(agent: dict, delay: float):
        if delay > 0:
            await asyncio.sleep(delay)
        return await call_single_agent(agent)

    tasks = [call_with_stagger(a, i * 2.0) for i, a in enumerate(agents)]
    results = []
    for coro in asyncio.as_completed(tasks):
        results.append(await coro)

    successful = [r for r in results if not r['error']]
    failed = [r for r in results if r['error']]

    return {
        'agent_responses': results,
        'all_agents_ok': len(failed) == 0,
        'has_any_response': len(successful) > 0,
    }
