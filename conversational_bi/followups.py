"""Schema-grounded follow-up suggestions.

Agno's native followups feature calls `followup_model.response(messages)` with
a fixed prompt built only from the user message and the answer — so it happily
suggests questions the book can't answer (industry benchmarks, yearly trends a
quarterly book doesn't have). `followup_model` officially accepts any Model, so
we plug in a Gemini subclass that injects the live schema and the governed
metric names into that call. Used ONLY for followups; the team and members keep
the plain model.
"""
from __future__ import annotations

from typing import Any

from agno.models.google import Gemini
from agno.models.message import Message

from . import data_layer, glossary


def _grounding_message() -> Message:
    """Built at call time so uploaded datasets are reflected immediately."""
    try:
        schema = data_layer.get_schema()
        dims = []
        for col in schema["columns"]:
            vals = col.get("categorical_values") or []
            if vals:
                shown = ", ".join(map(str, vals[:8]))
                more = ", …" if len(vals) > 8 else ""
                dims.append(f"- {col['label']} (values: {shown}{more})")
        dims_text = "\n".join(dims) if dims else "(no categorical columns)"
    except Exception:  # noqa: BLE001 - grounding is best-effort
        dims_text = "(schema unavailable)"

    metrics_text = ", ".join(e["label"] for e in glossary.METRICS.values())

    return Message(
        role="system",
        content=(
            "Grounding rules for the suggestions (these override everything "
            "else):\n"
            "- Suggest only questions answerable from this book of business.\n"
            f"- Available metrics: {metrics_text}.\n"
            "- Available dimensions to slice or group by:\n"
            f"{dims_text}\n"
            "- Time granularity: the quarters present in the data only.\n"
            "- NEVER suggest external data (industry benchmarks, market "
            "comparisons), forecasts, or fields not listed above.\n"
            "- Mix two kinds of suggestions: (a) specific drill-downs — a "
            "metric for a slice, a breakdown, a trend over quarters, a "
            "comparison; and (b) open-ended analytical questions that the data "
            "above can still answer — 'why', 'what is driving', 'what stands "
            "out', 'where is the risk concentrated'. Include at least one "
            "open-ended question.\n"
            "- Good shapes: 'Break <value> down by <dimension>', 'Show the "
            "quarterly <metric> trend for <value>', 'Why is <metric> moving "
            "in <value>?', 'What's driving the change in <value>?', 'Anything "
            "unusual in <value> this quarter?', 'Compare <value A> with "
            "<value B>'.\n"
            "- Use real dimension values from the lists above when drilling in."
        ),
    )


def _with_grounding(messages: list[Message]) -> list[Message]:
    """Merge the grounding into the system message. Gemini keeps only the LAST
    system message it sees (each overwrites the previous in _format_messages),
    so a separate grounding message would be dropped — append to the existing
    one instead."""
    grounding = _grounding_message().content
    out: list[Message] = []
    merged = False
    for msg in messages:
        if msg.role == "system" and not merged:
            out.append(Message(role="system", content=f"{msg.content}\n\n{grounding}"))
            merged = True
        else:
            out.append(msg)
    if not merged:
        out.insert(0, Message(role="system", content=grounding))
    return out


class GroundedFollowupGemini(Gemini):
    """Gemini that injects live schema grounding into the followup call."""

    def response(self, messages: list[Message], **kwargs: Any):  # type: ignore[override]
        return super().response(_with_grounding(messages), **kwargs)

    async def aresponse(self, messages: list[Message], **kwargs: Any):  # type: ignore[override]
        return await super().aresponse(_with_grounding(messages), **kwargs)
