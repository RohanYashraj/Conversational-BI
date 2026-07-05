"""Insight Agent: grounded commentary over already-computed figures.
Deliberately has no data access — it can only reason over what it is given."""
from __future__ import annotations

from agno.agent import Agent

from .. import config, prompts


def build_insight_agent() -> Agent:
    return Agent(
        id="insight-agent",
        name="Insight Agent",
        role="Explain computed figures in 1-3 sentences using other fields as evidence",
        model=config.gemini_model(),
        tools=[],  # deliberately no data access; it can only reason over given figures
        instructions=prompts.INSIGHT_AGENT,
    )
