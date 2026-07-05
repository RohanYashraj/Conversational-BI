"""Agno tools for the KPI Commentary Tool, organised by capability.

Tools are plain Python functions with type hints and docstrings (the docstring
is what the model sees). Anything touching numbers delegates to data_layer, so
the model only ever *reads* computed results. Tools that need conversational
memory accept an `agno.run.RunContext` and read/write session_state.

Adding a tool: create a module here (one capability per file), then export it
below and attach it to an agent/team in agents/ or teams/.
"""
from .anomalies import find_anomalies
from .bridge import build_premium_bridge, premium_bridge
from .charts import make_chart_spec
from .dashboard import dashboard_payload, default_dashboard
from .filters import get_active_filters, set_active_filters
from .glossary_tool import lookup_glossary
from .provenance import get_provenance, log_provenance
from .sql import describe_schema, query_data

__all__ = [
    "build_premium_bridge",
    "dashboard_payload",
    "default_dashboard",
    "describe_schema",
    "find_anomalies",
    "get_active_filters",
    "get_provenance",
    "log_provenance",
    "lookup_glossary",
    "make_chart_spec",
    "premium_bridge",
    "query_data",
    "set_active_filters",
]
