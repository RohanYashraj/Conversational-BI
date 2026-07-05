"""Per-session provenance: every SQL executed on behalf of a session, so each
answer can show its sources ("computed from N rows via this query").

Best-effort and in-memory; the persisted session_state audit_log remains the
durable trail.
"""
from __future__ import annotations

import time
from collections import deque
from typing import Any

from agno.run import RunContext

from .. import data_layer

_PROVENANCE_MAX_PER_SESSION = 200
_provenance: dict[str, deque[dict[str, Any]]] = {}


def log_provenance(
    run_context: RunContext | None, result: data_layer.QueryResult, source: str
) -> None:
    """Record an executed query against the session in run_context (no-op when
    there is no session, e.g. direct HTTP calls)."""
    session_id = getattr(run_context, "session_id", None)
    if not session_id:
        return
    log = _provenance.setdefault(
        session_id, deque(maxlen=_PROVENANCE_MAX_PER_SESSION)
    )
    log.append(
        {
            "ts": time.time(),
            "source": source,
            "sql": result.sql,
            "rows": result.row_count,
            "truncated": result.truncated,
            "elapsed_ms": result.elapsed_ms,
            "error": result.error,
        }
    )


def get_provenance(session_id: str, since: float = 0.0) -> list[dict[str, Any]]:
    """Queries executed for a session after `since` (unix seconds)."""
    return [e for e in _provenance.get(session_id, []) if e["ts"] > since]
