"""
load_state node — loads project state from PostgreSQL into the graph state.
"""

from typing import Optional
from db import load_project_state


def load_state_node(state: dict) -> dict:
    project_id = state['project_id']
    data = load_project_state(project_id)

    if not data['stage']:
        return {'error': 'No active stage found'}

    return {
        'query': data['project']['query'],
        'council_agents': data['council_agents'],
        'previous_round': data['previous_round'],
        'running_brief': data['running_brief'],
        'stage_id': data['stage']['id'],
        'stage_status': data['stage']['status'],
        'rounds_done': data['stage']['roundsDone'],
        'rounds_total': data['stage']['roundsTotal'],
    }
