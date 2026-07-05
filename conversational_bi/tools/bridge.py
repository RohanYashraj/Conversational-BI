"""Premium bridge (Orchestrator): the exact renewal premium walk —
Expiring → Exposure/Other → Rate → Renewed (+ New business) — with a
ready-to-render Vega-Lite waterfall. Deterministic SQL; legs tie out exactly."""
from __future__ import annotations

import json
from typing import Any

from agno.run import RunContext

from .. import data_layer
from .formatting import fmt_money, signed_money
from .provenance import log_provenance

_BRIDGE_COLS = ("expiry_gwp", "expiry_adjuted_gwp", "ren_gwp")


def build_premium_bridge(
    segment: str = "", region: str = "", run_context: RunContext | None = None
) -> dict[str, Any]:
    """Decompose the renewal premium walk into an exact, additive bridge with a
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
    log_provenance(run_context, res, source="premium_bridge")
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
            "amount": round(amount, 2), "amount_label": signed_money(amount, typ),
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
        f"Renewal premium walked from {fmt_money(expiring)} expiring to "
        f"{fmt_money(renewed)} renewed ({scope_txt}): rate added {signed_money(rate, 'delta')}, "
        f"exposure/other {signed_money(exposure, 'delta')}."
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
        build_premium_bridge(segment=segment, region=region, run_context=run_context),
        default=str,
    )
