"""Shared presentation/serialisation helpers used across tools."""
from __future__ import annotations

from typing import Any


def json_safe(obj: Any) -> Any:
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
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]
    return obj


def fmt_pct(v: Any) -> str:
    return f"{v * 100:.1f}%" if isinstance(v, (int, float)) else "n/a"


def fmt_money(v: Any) -> str:
    if not isinstance(v, (int, float)):
        return "n/a"
    a = abs(v)
    if a >= 1_000_000:
        return f"${v / 1_000_000:.2f}M"
    if a >= 1_000:
        return f"${v / 1_000:.1f}K"
    return f"${v:.0f}"


def signed_money(amount: float, kind: str) -> str:
    if kind == "total":
        return fmt_money(amount)
    sign = "+" if amount >= 0 else "−"
    return f"{sign}{fmt_money(abs(amount))}"


def loss_ratio_col(names: set[str]) -> str | None:
    """The loss-ratio column name varies by book (e.g. priced_loss_ratio vs
    loss_ratio); detect it from the live schema so cuts don't hard-fail."""
    return next((c for c in ("priced_loss_ratio", "loss_ratio") if c in names), None)
