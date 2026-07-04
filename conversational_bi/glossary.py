"""Business glossary: the governed definitions behind every metric.

Single source of truth — the glossary tool answers "what is X?" questions
verbatim from here, and the Query Agent's aggregation rules are generated from
the same entries, so the definition users read is always the calculation the
SQL actually performs.
"""
from __future__ import annotations

from typing import Any

# Each entry: what the business calls it, what it means, how it is calculated
# (in words), and the SQL pattern the Query Agent must use.
METRICS: dict[str, dict[str, str]] = {
    "premium": {
        "label": "Premium (GWP)",
        "definition": (
            "Gross written premium for the current/renewed term. The default "
            "premium measure for totals and rankings."
        ),
        "calculation": "Sum of renewed gross written premium.",
        "sql_pattern": "SUM(ren_gwp)",
    },
    "expiring premium": {
        "label": "Expiring Premium",
        "definition": "Gross written premium of the expiring term — the base the renewal is measured against.",
        "calculation": "Sum of expiring gross written premium.",
        "sql_pattern": "SUM(expiry_gwp)",
    },
    "weighted rate change": {
        "label": "Weighted Rate Change",
        "definition": (
            "Rate movement across a group of policies, weighted by expiring "
            "premium so large policies count proportionally. Never a plain "
            "average of policy-level rate changes."
        ),
        "calculation": "Sum of (rate change × expiring GWP) divided by sum of expiring GWP.",
        "sql_pattern": "SUM(rate_change * expiry_gwp) / NULLIF(SUM(expiry_gwp), 0)",
    },
    "loss ratio": {
        "label": "Loss Ratio",
        "definition": (
            "Priced loss ratio: expected losses as a share of premium. Lower "
            "is more profitable. Averaged per group for this POC."
        ),
        "calculation": "Average of the policy-level priced loss ratio (column name comes from the schema).",
        "sql_pattern": "AVG(<loss_ratio_column>)  -- e.g. priced_loss_ratio; confirm via describe_schema",
    },
    "retention": {
        "label": "Renewal Retention",
        "definition": (
            "How much of the premium that came up for renewal was kept, in "
            "premium terms. Can exceed 100% when rate/exposure growth "
            "outweighs lost business."
        ),
        "calculation": "Renewed GWP of renewal policies divided by their expiring GWP.",
        "sql_pattern": (
            "SUM(CASE WHEN lower(new_or_renewal) LIKE 'r%' THEN ren_gwp END) / "
            "NULLIF(SUM(CASE WHEN lower(new_or_renewal) LIKE 'r%' THEN expiry_gwp END), 0)"
        ),
    },
    "premium bridge": {
        "label": "Premium Bridge (Premium Walk)",
        "definition": (
            "Decomposition of the move from expiring to renewed premium into "
            "additive legs: Expiring → Exposure/Other change → Rate change → "
            "Renewed. The legs tie out exactly."
        ),
        "calculation": (
            "Exposure leg = expiry-adjusted GWP minus expiring GWP; Rate leg = "
            "renewed GWP minus expiry-adjusted GWP."
        ),
        "sql_pattern": "Use the premium_bridge tool — do not recompute by hand.",
    },
    "exposure change": {
        "label": "Exposure & Other Change",
        "definition": (
            "Premium movement from changes in the underlying exposure base "
            "(insured values, headcount, turnover) and other non-rate terms."
        ),
        "calculation": "Expiry-adjusted GWP minus expiring GWP (the bridge's exposure leg).",
        "sql_pattern": "SUM(expiry_adjuted_gwp) - SUM(expiry_gwp)",
    },
}


def lookup(term: str = "") -> dict[str, Any]:
    """Glossary lookup. Empty term returns the full glossary."""
    if not term.strip():
        return {"metrics": METRICS}
    key = term.strip().lower()
    if key in METRICS:
        return {"term": key, **METRICS[key]}
    # Loose match on key or label.
    matches = {
        k: v
        for k, v in METRICS.items()
        if key in k or key in v["label"].lower()
    }
    if matches:
        return {"metrics": matches}
    return {
        "term": term,
        "error": "Not in the glossary.",
        "available_terms": sorted(METRICS),
    }


def aggregation_rules() -> str:
    """The Query Agent's aggregation rules, generated from the glossary so the
    definition users read is always the SQL the agent writes."""
    lines = []
    for entry in METRICS.values():
        if entry["sql_pattern"].startswith("Use the"):
            continue
        lines.append(f"   - {entry['label']}: {entry['sql_pattern']}")
    return "\n".join(lines)
