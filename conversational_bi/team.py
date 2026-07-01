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

from . import config, prompts
from .agents import build_insight_agent, build_query_agent, build_viz_agent
from .tools import default_dashboard, get_active_filters, set_active_filters


def build_bi_team(*, db: SqliteDb) -> Team:
    """Construct the orchestrator team registered with AgentOS."""
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
        tools=[get_active_filters, set_active_filters, default_dashboard],
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
