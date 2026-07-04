"""Agno tools for the KPI Commentary Tool Agent.

Tools are plain Python functions with type hints and docstrings (the docstring
is what the model sees). Anything touching numbers delegates to data_layer, so
the model only ever *reads* computed results.

Tools that need conversational memory (the carried-forward filter) accept an
`agno.run.RunContext` and read/write `run_context.session_state`.
"""
from __future__ import annotations

import json
import time
from collections import deque
from typing import Any

from agno.run import RunContext

from . import data_layer, glossary


def lookup_glossary(term: str = "") -> str:
    """Look up the governed business definition of a metric: what it means and
    how it is calculated. Use this whenever the user asks "what is X?" or "how
    is X calculated?" for terms like premium, weighted rate change, loss ratio,
    retention, premium bridge, or exposure change. Pass an empty term to list
    the whole glossary. Answer strictly from what this returns — never invent
    a definition.
    """
    return json.dumps(glossary.lookup(term), indent=2)


# --------------------------------------------------------------------------
# Provenance: every SQL executed on behalf of a session, so each answer can
# show its sources ("computed from N rows via this query"). Best-effort and
# in-memory; the persisted session_state audit_log remains the durable trail.
# --------------------------------------------------------------------------
_PROVENANCE_MAX_PER_SESSION = 200
_provenance: dict[str, deque[dict[str, Any]]] = {}


def _log_provenance(run_context: RunContext | None, result: data_layer.QueryResult, source: str) -> None:
    session_id = getattr(run_context, "session_id", None)
    if not session_id:
        return
    log = _provenance.setdefault(session_id, deque(maxlen=_PROVENANCE_MAX_PER_SESSION))
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
    _log_provenance(run_context, result, source="query")

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
# Anomaly sweep (Orchestrator) — deterministic outlier detection
# --------------------------------------------------------------------------
def find_anomalies(run_context: RunContext) -> str:
    """Run a deterministic anomaly sweep over the book and return the notable
    outliers as JSON findings with real computed figures. Call this when the
    user asks "anything unusual?", "any outliers?", "what should I worry
    about?", or similar. Present the findings as a short list or table with
    the figures given — do not add findings of your own.

    Checks: quarter-over-quarter weighted rate-change swings per segment,
    segment loss ratios far from the book average, account concentration
    within segments, and large quarter-over-quarter premium moves.
    """
    tbl = data_layer.config.TABLE_NAME
    names = {c["sql_name"] for c in data_layer.get_schema()["columns"]}
    loss_col = _loss_ratio_col(names)
    findings: list[dict[str, Any]] = []

    def run(sql: str) -> data_layer.QueryResult:
        res = data_layer.run_sql(sql)
        _log_provenance(run_context, res, source="anomaly_sweep")
        return res

    # 1) Biggest quarter-over-quarter weighted rate-change swings per segment.
    if {"segment", "quarter", "rate_change", "expiry_gwp"} <= names:
        res = run(
            f'SELECT segment, quarter, '
            f'SUM(rate_change*expiry_gwp)/NULLIF(SUM(expiry_gwp),0) AS wrc '
            f'FROM "{tbl}" GROUP BY segment, quarter ORDER BY segment, quarter'
        )
        series: dict[str, list[tuple[Any, float]]] = {}
        for row in res.rows:
            if isinstance(row.get("wrc"), (int, float)):
                series.setdefault(row["segment"], []).append((row["quarter"], row["wrc"]))
        deltas = []
        for seg, pts in series.items():
            for (q0, v0), (q1, v1) in zip(pts, pts[1:]):
                deltas.append((abs(v1 - v0), seg, q0, q1, v0, v1))
        if deltas:
            mean = sum(d[0] for d in deltas) / len(deltas)
            var = sum((d[0] - mean) ** 2 for d in deltas) / len(deltas)
            std = var**0.5
            for d, seg, q0, q1, v0, v1 in sorted(deltas, reverse=True)[:3]:
                if std and (d - mean) / std >= 2:
                    findings.append({
                        "kind": "rate_swing", "severity": "high",
                        "headline": (
                            f"{seg}: weighted rate change moved {_fmt_pct(v0)} → {_fmt_pct(v1)} "
                            f"between quarter {q0} and {q1} — an unusually large swing."
                        ),
                    })

    # 2) Segment loss ratios far from the book average.
    if loss_col and "segment" in names:
        res = run(
            f'SELECT segment, AVG({loss_col}) AS lr, SUM(ren_gwp) AS premium '
            f'FROM "{tbl}" GROUP BY segment'
        )
        book = run(f'SELECT AVG({loss_col}) AS lr FROM "{tbl}"')
        book_lr = book.rows[0].get("lr") if book.rows else None
        if isinstance(book_lr, (int, float)):
            for row in res.rows:
                lr = row.get("lr")
                if isinstance(lr, (int, float)) and abs(lr - book_lr) >= 0.05:
                    word = "above" if lr > book_lr else "below"
                    findings.append({
                        "kind": "loss_ratio_outlier",
                        "severity": "high" if lr > book_lr else "info",
                        "headline": (
                            f"{row['segment']}: loss ratio {_fmt_pct(lr)} is "
                            f"{_fmt_pct(abs(lr - book_lr))} {word} the {_fmt_pct(book_lr)} book "
                            f"average, on {_fmt_money(row.get('premium'))} premium."
                        ),
                    })

    # 3) Account concentration inside a segment (top account > 15% of premium).
    if {"segment", "account_name"} <= names:
        res = run(
            f'SELECT segment, account_name, SUM(ren_gwp) AS premium, '
            f'SUM(SUM(ren_gwp)) OVER (PARTITION BY segment) AS seg_premium '
            f'FROM "{tbl}" GROUP BY segment, account_name '
            f'QUALIFY ROW_NUMBER() OVER (PARTITION BY segment ORDER BY SUM(ren_gwp) DESC) = 1'
        )
        for row in res.rows:
            prem, seg_prem = row.get("premium"), row.get("seg_premium")
            if isinstance(prem, (int, float)) and isinstance(seg_prem, (int, float)) and seg_prem:
                share = prem / seg_prem
                if share >= 0.15:
                    findings.append({
                        "kind": "concentration", "severity": "medium",
                        "headline": (
                            f"{row['segment']}: {row['account_name']} alone is "
                            f"{_fmt_pct(share)} of the segment's premium."
                        ),
                    })

    # 4) Latest-quarter premium swing vs prior quarter per segment (>30%).
    if {"segment", "quarter"} <= names:
        res = run(
            f'WITH q AS (SELECT MAX(quarter) AS latest FROM "{tbl}") '
            f'SELECT segment, '
            f'SUM(CASE WHEN quarter = (SELECT latest FROM q) THEN ren_gwp END) AS latest_prem, '
            f'SUM(CASE WHEN quarter = (SELECT latest FROM q) - 1 THEN ren_gwp END) AS prior_prem '
            f'FROM "{tbl}" GROUP BY segment'
        )
        for row in res.rows:
            lp, pp = row.get("latest_prem"), row.get("prior_prem")
            if isinstance(lp, (int, float)) and isinstance(pp, (int, float)) and pp:
                move = (lp - pp) / pp
                if abs(move) >= 0.30:
                    word = "jumped" if move > 0 else "dropped"
                    findings.append({
                        "kind": "premium_swing", "severity": "medium",
                        "headline": (
                            f"{row['segment']}: premium {word} {_fmt_pct(abs(move))} in the "
                            f"latest quarter ({_fmt_money(pp)} → {_fmt_money(lp)})."
                        ),
                    })

    order = {"high": 0, "medium": 1, "info": 2}
    findings.sort(key=lambda f: order.get(f["severity"], 3))
    return json.dumps(
        _json_safe({"findings": findings, "checks_run": 4, "anomaly_count": len(findings)}),
        indent=2,
    )


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


def _fmt_pct(v: Any) -> str:
    return f"{v * 100:.1f}%" if isinstance(v, (int, float)) else "n/a"


def _fmt_money(v: Any) -> str:
    if not isinstance(v, (int, float)):
        return "n/a"
    a = abs(v)
    if a >= 1_000_000:
        return f"${v / 1_000_000:.2f}M"
    if a >= 1_000:
        return f"${v / 1_000:.1f}K"
    return f"${v:.0f}"


def _build_briefing(headline: dict[str, Any], cuts: dict[str, Any]) -> list[dict[str, Any]]:
    """Derive the 2-4 most notable, decision-useful movements from the already
    computed cuts — softest pricing, margin risk, concentration, rate momentum.
    Every figure is a real computed number; each finding drills into full
    commentary when clicked. No LLM here, so the landing view is instant and
    can't hallucinate."""
    findings: list[dict[str, Any]] = []
    book_lr = headline.get("avg_loss_ratio")
    total = headline.get("total_gwp")
    segs = cuts.get("by_segment", {}).get("rows", [])

    # 1) Softest pricing segment.
    rated = [r for r in segs if isinstance(r.get("wtd_rate_change"), (int, float))]
    if rated:
        s = min(rated, key=lambda r: r["wtd_rate_change"])
        lr = s.get("avg_loss_ratio")
        detail = f"Weighted rate change is {_fmt_pct(s['wtd_rate_change'])}, the softest of {len(rated)} segments"
        if isinstance(lr, (int, float)) and isinstance(book_lr, (int, float)):
            rel = "below" if lr < book_lr else "above"
            detail += f", on a {_fmt_pct(lr)} loss ratio ({rel} the {_fmt_pct(book_lr)} book average)."
        else:
            detail += "."
        findings.append({
            "id": "softest",
            "tone": "watch" if s["wtd_rate_change"] < 0 else "info",
            "title": f"Softest pricing — {s['segment']}",
            "detail": detail,
            "drill": (
                f"Why is {s['segment']} the softest segment on rate? Break down its "
                "weighted rate change, loss ratio and new-vs-renewal mix, and explain the driver."
            ),
        })

    # 2) Highest loss ratio segment (margin watch).
    lrs = [r for r in segs if isinstance(r.get("avg_loss_ratio"), (int, float))]
    if lrs and isinstance(book_lr, (int, float)):
        s = max(lrs, key=lambda r: r["avg_loss_ratio"])
        delta = s["avg_loss_ratio"] - book_lr
        findings.append({
            "id": "loss",
            "tone": "watch" if delta > 0.03 else "info",
            "title": f"Highest loss ratio — {s['segment']}",
            "detail": (
                f"Loss ratio is {_fmt_pct(s['avg_loss_ratio'])}, {_fmt_pct(delta)} above the "
                f"{_fmt_pct(book_lr)} book average, on {_fmt_money(s.get('premium'))} of premium."
            ),
            "drill": (
                f"Break down {s['segment']}: loss ratio, rate change and premium — "
                "what is driving the loss ratio?"
            ),
        })

    # 3) Account concentration.
    accts = cuts.get("top_accounts", {}).get("rows", [])
    if accts and isinstance(total, (int, float)) and total:
        top1 = accts[0]
        top1_share = (top1.get("premium") or 0) / total
        topn = sum((a.get("premium") or 0) for a in accts) / total
        findings.append({
            "id": "concentration",
            "tone": "watch" if top1_share > 0.10 else "info",
            "title": "Account concentration",
            "detail": (
                f"The largest account ({top1.get('account_name')}) is {_fmt_pct(top1_share)} of GWP; "
                f"the top {len(accts)} are {_fmt_pct(topn)}."
            ),
            "drill": (
                "Show the top accounts by premium and assess how concentrated the book is — "
                "what share sits in the largest names?"
            ),
        })

    # 4) Rate momentum over the quarters.
    q = [r for r in cuts.get("quarterly_trend", {}).get("rows", [])
         if isinstance(r.get("wtd_rate_change"), (int, float))]
    if len(q) >= 2:
        first, last = q[0], q[-1]
        d = last["wtd_rate_change"] - first["wtd_rate_change"]
        tone, word = ("watch", "cooled") if d < -0.01 else ("positive", "firmed") if d > 0.01 else ("info", "held steady")
        findings.append({
            "id": "momentum",
            "tone": tone,
            "title": "Rate momentum",
            "detail": (
                f"Weighted rate change {word} from {_fmt_pct(first['wtd_rate_change'])} to "
                f"{_fmt_pct(last['wtd_rate_change'])} across {len(q)} quarters."
            ),
            "drill": "Show the quarterly weighted rate change trend and explain what's driving the momentum.",
        })

    order = {"watch": 0, "positive": 1, "info": 2}
    findings.sort(key=lambda f: order.get(f["tone"], 3))
    return findings


def _signed_money(amount: float, kind: str) -> str:
    if kind == "total":
        return _fmt_money(amount)
    sign = "+" if amount >= 0 else "−"
    return f"{sign}{_fmt_money(abs(amount))}"


_BRIDGE_COLS = ("expiry_gwp", "expiry_adjuted_gwp", "ren_gwp")


def _premium_bridge(
    segment: str = "", region: str = "", run_context: RunContext | None = None
) -> dict[str, Any]:
    """Decompose the renewal premium walk — Expiring → Exposure/Other → Rate →
    Renewed (+ New business when present) — into an exact, additive bridge with a
    ready-to-render Vega-Lite waterfall. Uses expiry_gwp, expiry_adjuted_gwp and
    ren_gwp so the components tie out to the penny."""
    tbl = data_layer.config.TABLE_NAME
    names = {c["sql_name"] for c in data_layer.get_schema()["columns"]}
    if not set(_BRIDGE_COLS) <= names:
        return {"error": "This book lacks the expiring/adjusted/renewed premium columns needed for a bridge.",
                "components": [], "spec": None}

    def esc(v: str) -> str:
        return v.replace("'", "''")

    filters: list[str] = []
    scope: list[str] = []
    if "new_or_renewal" in names:
        filters.append("lower(new_or_renewal) LIKE 'r%'")
    if segment and "segment" in names:
        filters.append(f"segment = '{esc(segment)}'")
        scope.append(segment)
    if region and "region" in names:
        filters.append(f"region = '{esc(region)}'")
        scope.append(region)
    where = " AND ".join(filters) if filters else "1=1"

    res = data_layer.run_sql(
        f'SELECT SUM(expiry_gwp) AS expiring, '
        f'SUM(expiry_adjuted_gwp)-SUM(expiry_gwp) AS exposure, '
        f'SUM(ren_gwp)-SUM(expiry_adjuted_gwp) AS rate, '
        f'SUM(ren_gwp) AS renewed FROM "{tbl}" WHERE {where}'
    )
    _log_provenance(run_context, res, source="premium_bridge")
    if res.error or not res.rows or not isinstance(res.rows[0].get("expiring"), (int, float)):
        return {"error": res.error or "No renewal premium found for that slice.",
                "components": [], "spec": None}
    r = res.rows[0]
    expiring, exposure, rate, renewed = (
        float(r["expiring"]), float(r["exposure"]), float(r["rate"]), float(r["renewed"])
    )

    # Optional new-business leg (books that carry new alongside renewals).
    new_biz = 0.0
    if "new_or_renewal" in names:
        nb_filters = ["lower(new_or_renewal) NOT LIKE 'r%'"]
        if segment and "segment" in names:
            nb_filters.append(f"segment = '{esc(segment)}'")
        if region and "region" in names:
            nb_filters.append(f"region = '{esc(region)}'")
        nb = data_layer.run_sql(
            f'SELECT SUM(ren_gwp) AS nb FROM "{tbl}" WHERE {" AND ".join(nb_filters)}'
        )
        nb_val = nb.rows[0].get("nb") if nb.rows else None
        # SUM over zero rows is NULL/NaN; treat that as no new business.
        if isinstance(nb_val, (int, float)) and nb_val == nb_val:
            new_biz = float(nb_val)

    steps = [("Expiring", expiring, "total"), ("Exposure", exposure, "delta"),
             ("Rate", rate, "delta"), ("Renewed", renewed, "total")]
    if new_biz:
        steps += [("New business", new_biz, "delta"), ("Total written", renewed + new_biz, "total")]

    values: list[dict[str, Any]] = []
    running = 0.0
    for i, (label, amount, typ) in enumerate(steps):
        if typ == "total":
            start, end, running = 0.0, amount, amount
            kind = "total"
        else:
            start, end, running = running, running + amount, running + amount
            kind = "increase" if amount >= 0 else "decrease"
        values.append({
            "label": label, "order": i, "kind": kind,
            "start": round(start, 2), "end": round(end, 2),
            "amount": round(amount, 2), "amount_label": _signed_money(amount, typ),
        })

    scope_txt = " / ".join(scope) if scope else "Portfolio"
    spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "title": f"Premium Bridge — {scope_txt}",
        "data": {"values": values},
        "encoding": {
            "x": {"field": "label", "type": "nominal", "sort": {"field": "order"},
                  "axis": {"labelAngle": 0, "title": None}},
        },
        "layer": [
            {"mark": {"type": "bar", "size": 42},
             "encoding": {
                 "y": {"field": "start", "type": "quantitative", "title": "GWP"},
                 "y2": {"field": "end"},
                 "color": {"field": "kind", "type": "nominal",
                           "scale": {"domain": ["total", "increase", "decrease"],
                                     "range": ["#6b7280", "#10b981", "#ef4444"]},
                           "legend": None}}},
            {"mark": {"type": "text", "dy": -6, "fontSize": 10},
             "encoding": {"y": {"field": "end", "type": "quantitative"},
                          "text": {"field": "amount_label"}}},
        ],
    }
    summary = (
        f"Renewal premium walked from {_fmt_money(expiring)} expiring to "
        f"{_fmt_money(renewed)} renewed ({scope_txt}): rate added {_signed_money(rate, 'delta')}, "
        f"exposure/other {_signed_money(exposure, 'delta')}."
    )
    return {"error": None, "scope": scope_txt, "components": values, "spec": spec,
            "summary": summary, "expiring": expiring, "exposure": exposure,
            "rate": rate, "renewed": renewed, "new_business": new_biz}


def premium_bridge(run_context: RunContext, segment: str = "", region: str = "") -> str:
    """Show the premium bridge (a renewal premium walk) as a waterfall: how the
    book moved from expiring premium to renewed premium via exposure/other change
    and rate change (plus new business when the book has it).

    Args:
        segment: optional segment to scope the bridge to (exact schema value).
        region: optional region to scope the bridge to (exact schema value).

    Returns JSON with `summary`, `components` (each leg's dollar amount) and a
    ready Vega-Lite `spec`. Present the components as a short table, embed the
    `spec` verbatim in a ```vega-lite fence, and add one line on the drivers.
    """
    return json.dumps(
        _premium_bridge(segment=segment, region=region, run_context=run_context),
        default=str,
    )


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


def default_dashboard(run_context: RunContext) -> str:
    """Return the standard on-load dashboard cuts (the same views as today's
    Summary tab): premium and weighted rate change by segment, by region, by
    underwriter, top accounts by premium, and the quarterly trend. Returns JSON
    with one block per cut. Call this when the user opens the tool or asks for
    "the dashboard" / "the overview".
    """
    out = {}
    for name, sql in _dashboard_cuts_sql().items():
        res = data_layer.run_sql(sql)
        _log_provenance(run_context, res, source=f"dashboard:{name}")
        out[name] = res.to_dict()
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
            "briefing": _build_briefing(headline_row, cuts),
            "premium_bridge": _premium_bridge(),
            "cuts": cuts,
        }
    )
