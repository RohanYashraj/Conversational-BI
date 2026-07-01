"""The BI Orchestrator team.

A coordinate-mode team: the leader owns the conversation, carries the active
filter forward, delegates computation/visualisation/commentary to the three
member agents, and assembles the final answer. Numbers only ever come from the
Query Agent's tools.
"""
from __future__ import annotations

from agno.db.sqlite import SqliteDb
from agno.team import Team
from agno.team.mode import TeamMode
from agno.tools.reasoning import ReasoningTools

from . import config, prompts
from .agents import build_insight_agent, build_query_agent, build_viz_agent
from .tools import default_dashboard, get_active_filters, premium_bridge, set_active_filters


def build_bi_team(*, db: SqliteDb) -> Team:
    """Construct the orchestrator team registered with AgentOS."""
    # Leader tools. With reasoning on, ReasoningTools lets the orchestrator
    # think in visible steps (streamed to the UI) before/while it delegates —
    # our own Gemini model drives it, so it stays model-agnostic and inside
    # the AgentOS framework.
    leader_tools = [get_active_filters, set_active_filters, default_dashboard, premium_bridge]
    if config.REASONING_ENABLED:
        leader_tools.insert(0, ReasoningTools(add_instructions=True))

    return Team(
        id="conversational-bi",
        name="KPI Commentary Tool",
        description=(
            "P&C portfolio Q&A with guarded SQL, charts, and grounded commentary. "
            "Numbers always come from executed queries, never from the model."
        ),
        model=config.gemini_model(),
        members=[
            build_query_agent(),
            build_viz_agent(),
            build_insight_agent(),
        ],
        mode=TeamMode.coordinate,
        tools=leader_tools,
        instructions=prompts.ORCHESTRATOR,
        session_state={"active_filters": {}, "audit_log": []},
        db=db,
        add_history_to_context=True,
        # Filters are carried forward by our own get/set_active_filters tools
        # plus conversation history — we don't need Agno's built-in agentic
        # state tool, which also emits a noisy arg-parse warning at startup.
        enable_agentic_state=False,
        markdown=True,
    )
