"""Central configuration for the Conversational BI Agent POC.

Everything that is likely to change between the demo and a real client
environment lives here, so moving from the dummy Excel file to a warehouse
is a config change, not a code change.
"""
from __future__ import annotations

import os
from pathlib import Path

from agno.models.google import Gemini
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env")

# --- Data source -----------------------------------------------------------
# POC: a local Excel/CSV file. Production: point DATA_PATH at an export, or
# replace data_layer.load_book() with a warehouse connection (see README).
DATA_PATH = os.getenv("BI_DATA_PATH", str(BASE_DIR / "data" / "Demo_Policy_Level_Dummy.xlsx"))

# The single logical table the agent queries. Keep this name stable; the
# agent's SQL is written against it, so a warehouse swap just re-points it.
TABLE_NAME = "policies"

# --- Model -----------------------------------------------------------------
# Gemini, matching the SSSIA stack. Override with env vars to swap models.
GEMINI_MODEL = os.getenv("BI_GEMINI_MODEL", "gemini-3.1-flash-lite")
# GOOGLE_API_KEY must be set in the environment for the Gemini client.


def gemini_model() -> Gemini:
    """Shared Gemini model instance for the team leader and member agents."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GOOGLE_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    return Gemini(id=GEMINI_MODEL, api_key=api_key)


# --- AgentOS / sessions ----------------------------------------------------
SESSION_DB_PATH = os.getenv("BI_SESSION_DB", str(BASE_DIR.parent / "bi_sessions.db"))
AGENT_OS_HOST = os.getenv("AGENT_OS_HOST", "localhost")
AGENT_OS_PORT = int(os.getenv("AGENT_OS_PORT", "8000"))
AGENT_OS_RELOAD = os.getenv("AGENT_OS_RELOAD", "false").lower() == "true"

# --- Guardrails for the SQL executor --------------------------------------
# Hard cap on rows returned to the model so a careless query can't flood
# the context window or leak the whole book.
MAX_ROWS = int(os.getenv("BI_MAX_ROWS", "1000"))

# Statements must begin with one of these (read-only).
ALLOWED_SQL_PREFIXES = ("select", "with")

# Whole-word tokens that are never allowed, even inside an otherwise valid
# SELECT (defence in depth on top of the SELECT-only rule).
BLOCKED_SQL_TOKENS = (
    "insert", "update", "delete", "drop", "alter", "create", "attach",
    "detach", "copy", "install", "load", "pragma", "export", "import_database",
    "set", "call", "replace", "truncate", "grant", "revoke", "vacuum", "merge",
)

# A categorical column is one with at most this many distinct values; we
# surface those values in the schema so the model can map "Financial Lines"
# or "North America" onto the real data without guessing.
CATEGORICAL_MAX_CARDINALITY = int(os.getenv("BI_CAT_MAX", "60"))

# --- Upload limits ---------------------------------------------------------
UPLOAD_MAX_BYTES = int(os.getenv("BI_UPLOAD_MAX_BYTES", str(10 * 1024 * 1024)))
