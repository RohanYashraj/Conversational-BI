"""Agno tools for the KPI Commentary Tool Agent.

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

    if not data:
        return "NO_CHART"

    mark = (chart_type or "").strip().lower()
    if mark not in ("line", "bar"):
        mark = "bar"
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
# Default dashboard (on-load view, callable as a tool AND served to the UI)
# --------------------------------------------------------------------------
def _json_safe(obj: Any) -> Any:
    """Make a value strictly JSON-serialisable for the HTTP response: unwrap
    numpy scalars and turn NaN/Infinity (invalid JSON that breaks the browser's
    JSON.parse) into None."""
    if hasattr(obj, "item") and not isinstance(obj, (str, bytes)):
        try:
            obj = obj.item()  # numpy scalar -> python scalar
        except Exception:  # noqa: BLE001
            pass
    if isinstance(obj, float):
        return None if (obj != obj or obj in (float("inf"), float("-inf"))) else obj
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    return obj


def _loss_ratio_col(names: set[str]) -> str | None:
    """The loss-ratio column name varies by book (e.g. priced_loss_ratio vs
    loss_ratio); detect it from the live schema so cuts don't hard-fail."""
    return next((c for c in ("priced_loss_ratio", "loss_ratio") if c in names), None)


def _dashboard_cuts_sql() -> dict[str, str]:
    """The standard on-load cuts, as {name: SQL}. Shared by the agent tool and
    the /dashboard endpoint so both stay in sync."""
    tbl = data_layer.config.TABLE_NAME
    names = {c["sql_name"] for c in data_layer.get_schema()["columns"]}
    loss_col = _loss_ratio_col(names)
    loss_sel = f", AVG({loss_col}) AS avg_loss_ratio" if loss_col else ""

    return {
        "by_segment": (
            f'SELECT segment, SUM(ren_gwp) AS premium, '
            f'SUM(rate_change*expiry_gwp)/NULLIF(SUM(expiry_gwp),0) AS wtd_rate_change'
            f'{loss_sel}, COUNT(*) AS policies '
            f'FROM "{tbl}" GROUP BY segment ORDER BY premium DESC'
        ),
        "by_region": (
            f'SELECT region, SUM(ren_gwp) AS premium, '
            f'SUM(rate_change*expiry_gwp)/NULLIF(SUM(expiry_gwp),0) AS wtd_rate_change'
            f'{loss_sel} FROM "{tbl}" GROUP BY region ORDER BY premium DESC'
        ),
        "by_underwriter": (
            f'SELECT underwriter, SUM(ren_gwp) AS premium, '
            f'SUM(premium_change) AS premium_change FROM "{tbl}" '
            f'GROUP BY underwriter ORDER BY premium DESC'
        ),
        "top_accounts": (
            f'SELECT account_name, SUM(ren_gwp) AS premium, COUNT(*) AS policies '
            f'FROM "{tbl}" GROUP BY account_name ORDER BY premium DESC LIMIT 10'
        ),
        "quarterly_trend": (
            f'SELECT quarter, SUM(rate_change*expiry_gwp)/NULLIF(SUM(expiry_gwp),0) AS wtd_rate_change'
            f'{loss_sel} FROM "{tbl}" GROUP BY quarter ORDER BY quarter'
        ),
    }


def default_dashboard() -> str:
    """Return the standard on-load dashboard cuts (the same views as today's
    Summary tab): premium and weighted rate change by segment, by region, by
    underwriter, top accounts by premium, and the quarterly trend. Returns JSON
    with one block per cut. Call this when the user opens the tool or asks for
    "the dashboard" / "the overview".
    """
    out = {name: data_layer.run_sql(sql).to_dict() for name, sql in _dashboard_cuts_sql().items()}
    return json.dumps(out, indent=2, default=str)


def dashboard_payload() -> dict[str, Any]:
    """Clean, UI-ready dashboard: headline KPIs plus the standard cuts as
    {columns, rows}. Served on load by the /dashboard endpoint so the app opens
    on a live portfolio view (not a blank chat). Every figure is real SQL."""
    tbl = data_layer.config.TABLE_NAME
    names = {c["sql_name"] for c in data_layer.get_schema()["columns"]}
    loss_col = _loss_ratio_col(names)

    # Headline KPIs — include only the ones the live schema supports.
    parts = [
        "SUM(ren_gwp) AS total_gwp",
        "SUM(rate_change*expiry_gwp)/NULLIF(SUM(expiry_gwp),0) AS wtd_rate_change",
        "COUNT(*) AS policy_count",
    ]
    if loss_col:
        parts.append(f"AVG({loss_col}) AS avg_loss_ratio")
    if "new_or_renewal" in names:
        # Renewal premium retention: renewed GWP over the premium up for renewal.
        # Books code renewals as "Renewal" or "R", so match on the leading "r".
        parts.append(
            "SUM(CASE WHEN lower(new_or_renewal) LIKE 'r%' THEN ren_gwp END)"
            "/NULLIF(SUM(CASE WHEN lower(new_or_renewal) LIKE 'r%' THEN expiry_gwp END),0)"
            " AS retention"
        )
    headline = data_layer.run_sql(f'SELECT {", ".join(parts)} FROM "{tbl}"')
    headline_row = headline.rows[0] if headline.rows else {}

    cuts: dict[str, Any] = {}
    for name, sql in _dashboard_cuts_sql().items():
        res = data_layer.run_sql(sql)
        cuts[name] = {"columns": res.columns, "rows": res.rows, "error": res.error}

    return _json_safe(
        {
            "table": tbl,
            "row_count": data_layer.get_schema()["row_count"],
            "headline": headline_row,
            "cuts": cuts,
        }
    )
