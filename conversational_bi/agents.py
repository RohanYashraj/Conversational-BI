"""Member agent definitions.

Each agent is narrow in scope (Agno's recommended pattern) so the team leader
can route cleanly and each context stays small. All run on Gemini by default;
the model is injected by the team but set here too so agents are usable
standalone in tests.
"""
from __future__ import annotations

from agno.agent import Agent

from . import config, prompts
from .tools import describe_schema, make_chart_spec, query_data


def build_query_agent() -> Agent:
    return Agent(
        id="query-agent",
        name="Query Agent",
        role="Translate questions into guarded SQL and return real computed figures",
        model=config.gemini_model(),
        tools=[describe_schema, query_data],
        instructions=prompts.QUERY_AGENT,
    )


def build_insight_agent() -> Agent:
    return Agent(
        id="insight-agent",
        name="Insight Agent",
        role="Explain computed figures in 1-3 sentences using other fields as evidence",
        model=config.gemini_model(),
        tools=[],  # deliberately no data access; it can only reason over given figures
        instructions=prompts.INSIGHT_AGENT,
    )


def build_viz_agent() -> Agent:
    return Agent(
        id="viz-agent",
        name="Visualization Agent",
        role="Build a chart spec for trend or comparison questions, else say NO_CHART",
        model=config.gemini_model(),
        tools=[make_chart_spec],
        instructions=prompts.VIZ_AGENT,
    )
