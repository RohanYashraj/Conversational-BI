"""AgentOS entry point for the KPI Commentary Tool agent.

Run:
    python -m conversational_bi.agent_os

Then connect at http://localhost:8000 from os.agno.com (Add OS → Local).

Requires:
    GOOGLE_API_KEY in the environment
    A data file at config.DATA_PATH (Demo_Policy_Level_Dummy.xlsx)
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from agno.db.sqlite import SqliteDb
from agno.os import AgentOS
from fastapi import File, HTTPException, UploadFile

from . import config, data_layer
from .team import build_bi_team

db = SqliteDb(db_file=config.SESSION_DB_PATH)
bi_team = build_bi_team(db=db)

_DATA_EXTENSIONS = {".xlsx", ".xls", ".csv"}


@asynccontextmanager
async def lifespan(app):
    data_layer.load_book()
    yield


agent_os = AgentOS(
    id="conversational-bi-os",
    name="KPI Commentary Tool",
    description="P&C portfolio Q&A with guarded SQL, charts, and grounded commentary.",
    teams=[bi_team],
    db=db,
    tracing=True,
    lifespan=lifespan,
)

app = agent_os.get_app()


@app.post("/datasets/upload")
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


if __name__ == "__main__":
    agent_os.serve(
        app="conversational_bi.agent_os:app",
        host=config.AGENT_OS_HOST,
        port=config.AGENT_OS_PORT,
        reload=config.AGENT_OS_RELOAD,
    )
