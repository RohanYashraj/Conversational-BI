"""Query Agent: the only component that touches data. Translates precise
questions into guarded SQL and returns real computed figures."""
from __future__ import annotations

from agno.agent import Agent

from .. import config, prompts
from ..tools import describe_schema, query_data


def build_query_agent() -> Agent:
    return Agent(
        id="query-agent",
        name="Query Agent",
        role="Translate questions into guarded SQL and return real computed figures",
        model=config.gemini_model(),
        tools=[describe_schema, query_data],
        instructions=prompts.QUERY_AGENT,
    )
