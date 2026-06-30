"""Agno tools for the Conversational BI Agent.

Tools are plain Python functions with type hints and docstrings (the docstring
is what the model sees). Anything touching numbers delegates to data_layer, so
the model only ever *reads* computed results.

Tools that need conversational memory (the carried-forward filter) accept an
`agno.run.RunContext` and read/write `run_context.session_state`.
"""
from __future__ import annotations

import json
from typing import Any

from agno.run import RunContext

from . import data_layer


# --------------------------------------------------------------------------
# Data tools (Query agent)
# --------------------------------------------------------------------------
def describe_schema() -> str:
    """Return the data schema: every column's SQL name, original label, type,
    and — for categorical columns — the list of valid values.

    Call this before writing SQL so you use real column names and map phrases
    like "Financial Lines" or "North America" onto actual values in the data.
    """
    return json.dumps(data_layer.get_schema(), indent=2, default=str)


def query_data(sql: str, run_context: RunContext) -> str:
    """Run a single read-only SQL SELECT against the policy book and return the
    real, computed result as JSON (columns + rows).

    Use this for every number, total, average, rate, ranking or breakdown.
    Rules:
    - SELECT/WITH only; one statement; no writes (the executor enforces this).
    - Table name is `policies`. Use the snake_case column names from
      describe_schema().
    - For rate change across a group, use a premium-weighted average:
      SUM(rate_change * expiry_gwp) / SUM(expiry_gwp), not a plain AVG.
    - Never invent a number. If the result is empty, report that.
    """
    result = data_layer.run_sql(sql)

    # Audit trail: record every executed query and its row count.
    if run_context.session_state is not None:
        log = run_context.session_state.setdefault("audit_log", [])
        log.append({"sql": result.sql, "rows": result.row_count, "error": result.error})

    return json.dumps(result.to_dict(), indent=2, default=str)


# --------------------------------------------------------------------------
# Follow-up context tools (Orchestrator)
# --------------------------------------------------------------------------
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


# --------------------------------------------------------------------------
# Visualization tool (Viz agent)
# --------------------------------------------------------------------------
def make_chart_spec(
    chart_type: str,
    data_json: str,
    x_field: str,
    y_field: str,
    title: str,
    series_field: str = "",
) -> str:
    """Build a Vega-Lite chart specification (returned as JSON) that a front-end
    can render. Use only for trend or comparison questions.

    Args:
        chart_type: "line" for trends over time, "bar" for comparisons across groups.
        data_json: JSON array of row objects (the computed result from the Query agent).
        x_field: field for the x-axis (e.g. "quarter" or "segment").
        y_field: field for the y-axis (the metric, e.g. "wtd_rate_change").
        title: short chart title.
        series_field: optional field to split into multiple series/colours (e.g. "segment").
    """
    try:
        data = json.loads(data_json)
        if isinstance(data, dict) and "rows" in data:
            data = data["rows"]
    except json.JSONDecodeError as e:
        return f"Error parsing data: {e}"

    mark = "line" if chart_type == "line" else "bar"
    encoding: dict[str, Any] = {
        "x": {"field": x_field, "type": "nominal" if mark == "bar" else "ordinal"},
        "y": {"field": y_field, "type": "quantitative"},
    }
    if series_field:
        encoding["color"] = {"field": series_field, "type": "nominal"}

    spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "title": title,
        "data": {"values": data},
        "mark": {"type": mark, "point": mark == "line"},
        "encoding": encoding,
    }
    return json.dumps(spec)


# --------------------------------------------------------------------------
# Default dashboard (on-load view, also callable as a tool)
# --------------------------------------------------------------------------
def default_dashboard() -> str:
    """Return the standard on-load dashboard cuts (the same views as today's
    Summary tab): premium and weighted rate change by segment, by region, by
    underwriter, top accounts by premium, and the quarterly trend. Returns JSON
    with one block per cut. Call this when the user opens the tool or asks for
    "the dashboard" / "the overview".
    """
    tbl = data_layer.config.TABLE_NAME
    cuts = {
        "by_segment": (
            f'SELECT segment, SUM(ren_gwp) AS premium, '
            f'SUM(rate_change*expiry_gwp)/NULLIF(SUM(expiry_gwp),0) AS wtd_rate_change, '
            f'AVG(loss_ratio) AS avg_loss_ratio, COUNT(*) AS policies '
            f'FROM {tbl} GROUP BY segment ORDER BY premium DESC'
        ),
        "by_region": (
            f'SELECT region, SUM(ren_gwp) AS premium, '
            f'SUM(rate_change*expiry_gwp)/NULLIF(SUM(expiry_gwp),0) AS wtd_rate_change, '
            f'AVG(loss_ratio) AS avg_loss_ratio FROM {tbl} GROUP BY region ORDER BY premium DESC'
        ),
        "by_underwriter": (
            f'SELECT underwriter, SUM(ren_gwp) AS premium, '
            f'SUM(premium_change) AS premium_change FROM {tbl} '
            f'GROUP BY underwriter ORDER BY premium DESC'
        ),
        "top_accounts": (
            f'SELECT account_name, SUM(ren_gwp) AS premium, COUNT(*) AS policies '
            f'FROM {tbl} GROUP BY account_name ORDER BY premium DESC LIMIT 10'
        ),
        "quarterly_trend": (
            f'SELECT quarter, SUM(rate_change*expiry_gwp)/NULLIF(SUM(expiry_gwp),0) AS wtd_rate_change, '
            f'AVG(loss_ratio) AS avg_loss_ratio FROM {tbl} GROUP BY quarter ORDER BY quarter'
        ),
    }
    out = {name: data_layer.run_sql(sql).to_dict() for name, sql in cuts.items()}
    return json.dumps(out, indent=2, default=str)
