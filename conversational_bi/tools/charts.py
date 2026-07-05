"""Visualisation tool (Viz Agent): computed rows in, Vega-Lite spec out."""
from __future__ import annotations

import json
from typing import Any


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
