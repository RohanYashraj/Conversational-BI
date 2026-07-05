"""Custom FastAPI routes attached on top of the AgentOS API.

These serve the UI features that sit outside the chat stream: the on-load
dashboard, per-answer provenance, and dataset uploads. Adding an endpoint:
add it to this router (or a new module + router for a bigger surface).
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from .. import config, data_layer, tools

router = APIRouter()

_DATA_EXTENSIONS = {".xlsx", ".xls", ".csv"}


@router.get("/provenance/{session_id}")
async def provenance(session_id: str, since: float = 0.0) -> dict:
    """Queries executed for a session after `since` (unix seconds). The UI
    fetches this when a run completes and renders a per-answer "Sources" panel:
    the exact SQL, rows returned and timing behind every figure shown."""
    schema = data_layer.get_schema()
    return {
        "table": schema["table"],
        "table_rows": schema["row_count"],
        "queries": tools.get_provenance(session_id, since=since),
    }


@router.get("/dashboard")
async def dashboard() -> dict:
    """On-load portfolio overview: headline KPIs + the standard cuts, computed
    from real SQL. The UI renders this immediately so the app opens on a live
    dashboard the user can drill into via chat."""
    return tools.dashboard_payload()


@router.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict:
    """Accept a tabular upload and reload the in-memory DuckDB book."""
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    if ext not in _DATA_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type {ext!r}. Use .xlsx, .xls or .csv.",
        )

    content = await file.read()
    if len(content) > config.UPLOAD_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File exceeds maximum size of "
                f"{config.UPLOAD_MAX_BYTES // (1024 * 1024)} MB."
            ),
        )

    try:
        df = data_layer.read_dataframe_from_upload(filename, content)
        schema = data_layer.reload_book(df)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse upload: {exc}",
        ) from exc

    return {
        "filename": filename,
        "row_count": len(df),
        "columns": list(df.columns),
        "schema": schema,
    }
