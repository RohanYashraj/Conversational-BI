"""Member agent definitions, one module per agent (Agno's recommended
pattern): each agent is narrow in scope so the team leader routes cleanly and
each context stays small.

Adding an agent: create a module here with a build_<name>_agent() factory,
export it below, and attach it to a team in teams/ (or register it standalone
with AgentOS in agent_os.py).
"""
from .insight import build_insight_agent
from .query import build_query_agent
from .viz import build_viz_agent

__all__ = ["build_insight_agent", "build_query_agent", "build_viz_agent"]
