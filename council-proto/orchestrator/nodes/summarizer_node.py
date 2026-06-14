"""
summarizer_node — calls summarizer model to update the running brief.
Emits real-time events during execution.
Always writes SOMETHING to the brief — never silently fails.
"""

import os
from model_wrapper import call_model
from context_builder import build_summarizer_context
from db import update_running_brief
from callbacks import emit_event

SUMMARIZER_MODEL = os.getenv('SUMMARIZER_MODEL', 'microsoft/phi-3-mini-128k-instruct')


async def summarizer_node(state: dict) -> dict:
    responses = state.get('agent_responses', [])
    project_id = state.get('project_id', '')
    round_id = state.get('round_id', '')
    round_number = state.get('round_number', 0)
    current_brief = state.get('running_brief', '')

    await emit_event('summarizer:running', {
        'projectId': project_id,
        'roundId': round_id,
    })

    messages = build_summarizer_context(responses, current_brief, round_number)

    result = await call_model(
        messages=messages,
        model=SUMMARIZER_MODEL,
    )

    content = result['content']

    if content.startswith('[ERROR:') or content.startswith('[TIMEOUT'):
        print(f'  [summarizer] model failed — using fallback: {content[:80]}')
        await emit_event('summarizer:complete', {
            'projectId': project_id,
            'roundId': round_id,
            'error': True,
            'brief': '',
        })
        content = _build_fallback_brief(responses, round_number, current_brief)

    try:
        update_running_brief(project_id, content, round_number)
    except Exception as e:
        print(f'  [summarizer] DB write failed: {e}')

    await emit_event('summarizer:complete', {
        'projectId': project_id,
        'roundId': round_id,
        'error': content.startswith('[ERROR:') or content.startswith('[TIMEOUT'),
        'brief': content[:500],
    })

    return {'updated_brief': content, 'summarizer_ok': True}


def _build_fallback_brief(responses: list, round_number: int, current_brief: str) -> str:
    prefix = f'## Round {round_number} Summary\n\n'
    successful = [r for r in responses if not r.get('error') and r.get('response')]

    if not successful:
        if current_brief:
            return prefix + 'All agents were unable to respond this round. The existing brief continues below.\n\n' + current_brief
        return prefix + 'No agent responses were generated this round.'

    lines = []
    for r in successful:
        text = (r.get('response', '') or '').strip()
        lines.append(f'**{r["agentName"]}** — {text[:500]}')

    return prefix + '\n\n'.join(lines) + '\n\n---\n\n' + current_brief
