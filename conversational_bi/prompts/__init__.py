"""System prompts (instructions), one module per role.

Prompt tuning stays a single place to look: each module owns one role's
instructions and is re-exported here. Adding an agent means adding a prompt
module and exporting it below.
"""
from .insight_agent import INSIGHT_AGENT
from .orchestrator import ORCHESTRATOR
from .query_agent import QUERY_AGENT
from .viz_agent import VIZ_AGENT

__all__ = ["INSIGHT_AGENT", "ORCHESTRATOR", "QUERY_AGENT", "VIZ_AGENT"]
