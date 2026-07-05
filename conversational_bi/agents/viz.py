"""Visualization Agent: builds a Vega-Lite spec for trend/comparison
questions, or answers NO_CHART."""
from __future__ import annotations

from agno.agent import Agent

from .. import config, prompts
from ..tools import make_chart_spec


def build_viz_agent() -> Agent:
    return Agent(
        id="viz-agent",
        name="Visualization Agent",
        role="Build a chart spec for trend or comparison questions, else say NO_CHART",
        model=config.gemini_model(),
        tools=[make_chart_spec],
        instructions=prompts.VIZ_AGENT,
    )
