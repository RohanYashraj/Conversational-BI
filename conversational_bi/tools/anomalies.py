"""Anomaly sweep (Orchestrator): deterministic outlier detection — every
finding is a computed figure, never an LLM judgement."""
from __future__ import annotations

import json
from typing import Any

from agno.run import RunContext

from .. import data_layer
from .formatting import fmt_money, fmt_pct, json_safe, loss_ratio_col
from .provenance import log_provenance


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
    loss_col = loss_ratio_col(names)
    findings: list[dict[str, Any]] = []

    def run(sql: str) -> data_layer.QueryResult:
        res = data_layer.run_sql(sql)
        log_provenance(run_context, res, source="anomaly_sweep")
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
                            f"{seg}: weighted rate change moved {fmt_pct(v0)} → {fmt_pct(v1)} "
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
                            f"{row['segment']}: loss ratio {fmt_pct(lr)} is "
                            f"{fmt_pct(abs(lr - book_lr))} {word} the {fmt_pct(book_lr)} book "
                            f"average, on {fmt_money(row.get('premium'))} premium."
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
                            f"{fmt_pct(share)} of the segment's premium."
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
                            f"{row['segment']}: premium {word} {fmt_pct(abs(move))} in the "
                            f"latest quarter ({fmt_money(pp)} → {fmt_money(lp)})."
                        ),
                    })

    order = {"high": 0, "medium": 1, "info": 2}
    findings.sort(key=lambda f: order.get(f["severity"], 3))
    return json.dumps(
        json_safe({"findings": findings, "checks_run": 4, "anomaly_count": len(findings)}),
        indent=2,
    )
