"""
Context builder — assembles bounded prompts for each agent type.
Exact templates from §7 of the prototype specification.
"""

def build_council_context(
    agent: dict,
    query: str,
    previous_round: list,
    running_brief: str,
) -> list:
    """§7.1 — Council Agent Context Template."""
    prev_text = _format_previous_round(previous_round)
    brief_text = running_brief if running_brief else 'No brief yet. This is the first round.'

    system = (
        f'You are {agent["name"]}.\n'
        f'{agent["personaPrompt"]}\n'
        f'\n'
        f'RUNNING BRIEF (accumulated project knowledge):\n'
        f'{brief_text}\n'
        f'\n'
        f'PREVIOUS ROUND MESSAGES:\n'
        f'{prev_text}\n'
    )

    user = (
        f'{query}\n'
        f'\n'
        f'Respond in your persona. Be specific, critical, and actionable.\n'
        f'Reference prior points where relevant. Do not summarise — analyse.'
    )

    return [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user},
    ]


def build_summarizer_context(
    responses: list,
    current_brief: str,
    round_number: int,
) -> list:
    """§7.2 — Summarizer Context Template. Uses Phi-3 Mini."""
    brief_text = current_brief if current_brief else 'Start fresh.'

    responses_text = ''
    for r in responses:
        responses_text += f'=== {r["agentName"]} ===\n{r["response"]}\n\n'

    system = (
        'You are a precise technical summarizer. Your only job is to update the running\n'
        'brief with the key points from the round below.'
    )

    user = (
        f'CURRENT RUNNING BRIEF:\n'
        f'{brief_text}\n'
        f'\n'
        f'ROUND {round_number} — ALL AGENT RESPONSES:\n'
        f'{responses_text}\n'
        f'Update the running brief. Extract the 3-5 most important new points from this round.\n'
        f'Append them to the existing brief. Keep the total brief under 800 words.\n'
        f'Return ONLY the updated brief as plain text. No preamble. No commentary.'
    )

    return [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user},
    ]


def build_leader_context(
    query: str,
    updated_brief: str,
) -> list:
    system = (
        'You are a professional AI assistant delivering a final answer to the user.\n'
        '\n'
        'Your response MUST use proper markdown throughout. Every answer must render beautifully.\n'
        '\n'
        'REQUIRED FORMAT:\n'
        '- Start with a # title that restates the question briefly\n'
        '- Use ## section headers to organize content (2-4 sections max)\n'
        '- Use **bold** for all key terms, labels, and emphasized concepts\n'
        '- Use bullet lists ( - ) for unordered items\n'
        '- Use numbered lists (1. 2. 3.) for steps, priorities, or ranked items\n'
        '- Use > for important callouts, warnings, or key takeaways\n'
        '- Use --- only between major sections if needed\n'
        '- End with > **Key Takeaway:** or > **Next Step:** as a final callout\n'
        '\n'
        'CONTENT RULES:\n'
        '- Do NOT mention agents, rounds, council, or internal debate\n'
        '- Do NOT include raw syntax, code fences, or unformatted text\n'
        '- Do NOT quote individual agents or show dialogue\n'
        '- Answer the original question directly — no preamble like "based on the discussion"\n'
        '- Write as a single expert voice — unified, confident, authoritative\n'
        '- Be concise: 3-5 paragraphs with headers. No filler, no repetition\n'
        '\n'
        'EXAMPLE OUTPUT:\n'
        '# Should We Expand to Southeast Asia?\n'
        '\n'
        'Yes, but with a phased approach starting in Singapore.\n'
        '\n'
        '## Market Opportunity\n'
        '- The region has **3.2B** potential users with **65%** mobile penetration\n'
        '- Singapore offers the strongest regulatory and infrastructure base\n'
        '- Vietnam and Indonesia follow as high-growth Tier 2 markets\n'
        '\n'
        '## Key Risks\n'
        '1. **Regulatory fragmentation** across 11 distinct legal systems\n'
        '2. **Talent competition** from established tech hubs\n'
        '3. **Currency volatility** in emerging markets\n'
        '\n'
        '> **Recommended next step:** Run a 4-week pilot in Singapore before committing to a full rollout.\n'
        '\n'
        'TONE: Professional but conversational. Confident. No hedging or weasel words.'
    )

    user = (
        f'INTERNAL BRIEFING (for your context only — do not reference this in your answer):\n'
        f'{updated_brief}\n'
        f'\n'
        f'USER QUESTION:\n'
        f'{query}\n'
        f'\n'
        f'Answer the user directly using the required format above.'
    )

    return [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user},
    ]


def build_on_deck_context(
    agent: dict,
    running_brief: str,
    next_stage_name: str,
) -> list:
    """§7.4 — On-Deck Minimal Briefing Template."""
    system = (
        f'You are {agent["name"]}.\n'
        f'{agent["personaPrompt"]}\n'
        f'\n'
        f'You are currently On-Deck. You will join the active Council in the next stage.\n'
        f'\n'
        f'PROJECT BRIEF (what has been established so far):\n'
        f'{running_brief}\n'
        f'\n'
        f'NEXT STAGE OBJECTIVE:\n'
        f'{next_stage_name}'
    )

    user = (
        'Acknowledge this briefing with a single paragraph confirming your understanding\n'
        'and your intended focus for the next stage. You will be called for full responses soon.'
    )

    return [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user},
    ]


def build_bunkhouse_promotion_context(
    agent: dict,
    running_brief: str,
    next_stage_name: str,
) -> list:
    """§7.5 — Bunkhouse-to-Council Promotion Briefing (FR-055a)."""
    system = (
        f'You are {agent["name"]}.\n'
        f'{agent["personaPrompt"]}\n'
        f'\n'
        f'You are being activated from the Bunkhouse and joining the Council for the next stage.\n'
        f'\n'
        f'PROJECT BRIEF (what has been established so far):\n'
        f'{running_brief}\n'
        f'\n'
        f'NEXT STAGE OBJECTIVE:\n'
        f'{next_stage_name}'
    )

    user = (
        'Acknowledge this briefing with a single paragraph confirming your understanding\n'
        'and your intended focus for the next stage. You will be called for full responses soon.'
    )

    return [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user},
    ]


def build_spotlight_context(
    agent: dict,
    spotlight_query: str,
    previous_round: list,
    running_brief: str,
) -> list:
    """§7.6 — Spotlight Context Template. Leader does NOT process this."""
    prev_text = _format_previous_round(previous_round)

    system = (
        f'You are {agent["name"]}.\n'
        f'{agent["personaPrompt"]}\n'
        f'\n'
        f'RUNNING BRIEF:\n'
        f'{running_brief}\n'
        f'\n'
        f'PREVIOUS ROUND MESSAGES:\n'
        f'{prev_text}'
    )

    user = (
        f'{spotlight_query}\n'
        f'\n'
        f'You are being addressed directly. Give your complete, unfiltered response.\n'
        f'Show your full reasoning, internal debate, and complete position.\n'
        f'The Leader will NOT process this response. This goes directly to the Operator.'
    )

    return [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user},
    ]


def _format_previous_round(previous_round: list) -> str:
    if not previous_round:
        return 'None. This is the first round of this stage.'
    lines = []
    for r in previous_round:
        name = r.get('agentName') or r.get('name') or 'Unknown'
        lines.append(f'{name}: {r["response"]}')
    return '\n'.join(lines)
