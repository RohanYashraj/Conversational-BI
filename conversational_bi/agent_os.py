"""AgentOS entry point — the thin composition root.

Everything is built elsewhere and assembled here:
    db/      -> the sessions/memory/traces database (Neon in prod, SQLite in dev)
    teams/   -> every team registered with the OS (one line each in build_all_teams)
    agents/  -> member agents used by the teams
    tools/   -> capabilities, one module each
    api/     -> custom endpoints on top of the AgentOS API
    config   -> all environment-driven settings

Run:
    python -m conversational_bi.agent_os

Then connect at http://localhost:8000 from the bundled UI (ui/) or os.agno.com.

Requires:
    GOOGLE_API_KEY in the environment
    A data file at config.DATA_PATH (Demo_Policy_Level_Dummy.xlsx)
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from agno.os import AgentOS

from . import config, data_layer
from .api import router as api_router
from .db import build_db
from .teams import build_all_teams

db = build_db()


@asynccontextmanager
async def lifespan(app):
    data_layer.load_book()
    yield


agent_os = AgentOS(
    id="conversational-bi-os",
    name="KPI Commentary Tool",
    description="P&C portfolio Q&A with guarded SQL, charts, and grounded commentary.",
    teams=build_all_teams(db=db),
    db=db,
    tracing=True,
    lifespan=lifespan,
    cors_allowed_origins=config.CORS_ORIGINS or None,
    # Post hooks (session auto-naming) run as background tasks so they never
    # delay the answer stream.
    run_hooks_in_background=True,
)

app = agent_os.get_app()
app.include_router(api_router)


if __name__ == "__main__":
    agent_os.serve(
        app="conversational_bi.agent_os:app",
        host=config.AGENT_OS_HOST,
        port=config.AGENT_OS_PORT,
        reload=config.AGENT_OS_RELOAD,
    )
