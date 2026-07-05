"""Default dashboard (on-load view): callable as an agent tool AND served
directly to the UI by the /dashboard endpoint. Every figure is real SQL; the
briefing is derived deterministically (no LLM), so the landing view is instant
and can't hallucinate."""
from __future__ import annotations

import json
from typing import Any

from agno.run import RunContext

from .. import data_layer
from .bridge import build_premium_bridge
from .formatting import fmt_money, fmt_pct, json_safe, loss_ratio_col
from .provenance import log_provenance


def _dashboard_cuts_sql() -> dict[str, str]:
    """The standard on-load cuts, as {name: SQL}. Shared by the agent tool and
    the /dashboard endpoint so both stay in sync."""
    tbl = data_layer.config.TABLE_NAME
    names = {c["sql_name"] for c in data_layer.get_schema()["columns"]}
    loss_col = loss_ratio_col(names)
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


def _build_briefing(headline: dict[str, Any], cuts: dict[str, Any]) -> list[dict[str, Any]]:
    """Derive the 2-4 most notable, decision-useful movements from the already
    computed cuts — softest pricing, margin risk, concentration, rate momentum.
    Every figure is a real computed number; each finding drills into full
    commentary when clicked."""
    findings: list[dict[str, Any]] = []
    book_lr = headline.get("avg_loss_ratio")
    total = headline.get("total_gwp")
    segs = cuts.get("by_segment", {}).get("rows", [])

    # 1) Softest pricing segment.
    rated = [r for r in segs if isinstance(r.get("wtd_rate_change"), (int, float))]
    if rated:
        s = min(rated, key=lambda r: r["wtd_rate_change"])
        lr = s.get("avg_loss_ratio")
        detail = f"Weighted rate change is {fmt_pct(s['wtd_rate_change'])}, the softest of {len(rated)} segments"
        if isinstance(lr, (int, float)) and isinstance(book_lr, (int, float)):
            rel = "below" if lr < book_lr else "above"
            detail += f", on a {fmt_pct(lr)} loss ratio ({rel} the {fmt_pct(book_lr)} book average)."
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
                f"Loss ratio is {fmt_pct(s['avg_loss_ratio'])}, {fmt_pct(delta)} above the "
                f"{fmt_pct(book_lr)} book average, on {fmt_money(s.get('premium'))} of premium."
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
                f"The largest account ({top1.get('account_name')}) is {fmt_pct(top1_share)} of GWP; "
                f"the top {len(accts)} are {fmt_pct(topn)}."
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
                f"Weighted rate change {word} from {fmt_pct(first['wtd_rate_change'])} to "
                f"{fmt_pct(last['wtd_rate_change'])} across {len(q)} quarters."
            ),
            "drill": "Show the quarterly weighted rate change trend and explain what's driving the momentum.",
        })

    order = {"watch": 0, "positive": 1, "info": 2}
    findings.sort(key=lambda f: order.get(f["tone"], 3))
    return findings


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
        log_provenance(run_context, res, source=f"dashboard:{name}")
        out[name] = res.to_dict()
    return json.dumps(out, indent=2, default=str)


def dashboard_payload() -> dict[str, Any]:
    """Clean, UI-ready dashboard: headline KPIs plus the standard cuts as
    {columns, rows}. Served on load by the /dashboard endpoint so the app opens
    on a live portfolio view (not a blank chat). Every figure is real SQL."""
    tbl = data_layer.config.TABLE_NAME
    names = {c["sql_name"] for c in data_layer.get_schema()["columns"]}
    loss_col = loss_ratio_col(names)

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

    return json_safe(
        {
            "table": tbl,
            "row_count": data_layer.get_schema()["row_count"],
            "headline": headline_row,
            "briefing": _build_briefing(headline_row, cuts),
            "premium_bridge": build_premium_bridge(),
            "cuts": cuts,
        }
    )
