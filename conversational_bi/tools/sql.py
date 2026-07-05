"""Data tools (Query Agent): schema discovery and guarded SQL execution.

Anything touching numbers delegates to data_layer, so the model only ever
*reads* computed results.
"""
from __future__ import annotations

import json

from agno.run import RunContext

from .. import data_layer
from .provenance import log_provenance


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
    log_provenance(run_context, result, source="query")

    return json.dumps(result.to_dict(), indent=2, default=str)
