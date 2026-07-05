"""Database factory for AgentOS sessions/memory/traces.

Neon Postgres in production (BI_DATABASE_URL set), local SQLite in dev.
Same agno DB interface either way, so switching environments is a config
change only.
"""
from __future__ import annotations

from agno.db.base import BaseDb
from agno.db.sqlite import SqliteDb

from .. import config


def build_db() -> BaseDb:
    """The AgentOS database for the current environment."""
    if config.DATABASE_URL:
        from agno.db.postgres import PostgresDb

        url = config.DATABASE_URL
        # Neon hands out postgres(ql):// URLs; SQLAlchemy would resolve those
        # to the psycopg2 driver, but we ship psycopg (v3) — pin it explicitly.
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        # libpq waits FOREVER on an unreachable host by default, which shows
        # up as the server hanging at "Waiting for application startup." —
        # fail fast with a clear error instead.
        if "connect_timeout=" not in url:
            url += ("&" if "?" in url else "?") + "connect_timeout=10"
        return PostgresDb(db_url=url)
    return SqliteDb(db_file=config.SESSION_DB_PATH)


__all__ = ["build_db"]
