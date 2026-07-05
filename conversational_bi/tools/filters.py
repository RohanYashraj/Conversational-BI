"""Follow-up context tools (Orchestrator): the filter carried across turns so
"now just North America" resolves against the previous slice."""
from __future__ import annotations

import json

from agno.run import RunContext


def get_active_filters(run_context: RunContext) -> str:
    """Return the filters currently carried forward from earlier turns
    (e.g. {"segment": "Liability"}). Use these to resolve follow-ups like
    "now just North America" or "break that down by region".
    """
    filters = (run_context.session_state or {}).get("active_filters", {})
    return json.dumps(filters)


def set_active_filters(filters_json: str, run_context: RunContext) -> str:
    """Replace the carried-forward filter context. Pass a JSON object such as
    {"segment": "Liability", "region": "North America"}. Pass {} to clear.
    Call this whenever the user narrows, widens, or changes the slice so the
    next turn inherits the right context.
    """
    try:
        filters = json.loads(filters_json) if filters_json.strip() else {}
        if not isinstance(filters, dict):
            return "Error: filters must be a JSON object."
    except json.JSONDecodeError as e:
        return f"Error parsing filters: {e}"
    if run_context.session_state is not None:
        run_context.session_state["active_filters"] = filters
    return f"Active filters set to: {json.dumps(filters)}"
