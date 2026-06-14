"""
LangGraph graph definition — wires all nodes into the orchestration state graph.
"""

from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from nodes.load_state import load_state_node
from nodes.council_node import council_agents_node
from nodes.summarizer_node import summarizer_node
from nodes.leader_node import leader_node
from nodes.transition_node import transition_check, transition_execute_node


class OrchestrationState(TypedDict):
    project_id: str
    stage_id: str
    round_id: str
    round_number: int
    order_index: int
    stage_status: str
    rounds_done: int
    rounds_total: int
    error: Optional[str]

    query: str
    council_agents: list
    previous_round: list
    running_brief: str

    agent_responses: list
    all_agents_ok: bool
    has_any_response: bool

    updated_brief: str
    summarizer_ok: bool

    leader_synthesis: str
    leader_ok: bool

    stage_complete: bool
    project_complete: bool
    transition_ok: bool
    transition_error: Optional[str]
    next_stage_id: Optional[str]
    next_stage_name: Optional[str]


def build_graph() -> StateGraph:
    builder = StateGraph(OrchestrationState)

    builder.add_node('load_state', load_state_node)
    builder.add_node('council_agents', council_agents_node)
    builder.add_node('summarizer', summarizer_node)
    builder.add_node('leader', leader_node)
    builder.add_node('transition_execute', transition_execute_node)

    builder.set_entry_point('load_state')

    builder.add_edge('load_state', 'council_agents')
    builder.add_edge('council_agents', 'summarizer')
    builder.add_edge('summarizer', 'leader')

    builder.add_conditional_edges(
        'leader',
        transition_check,
        {'transition': 'transition_execute', 'end': END},
    )

    builder.add_edge('transition_execute', END)

    return builder.compile()


round_graph = build_graph()
