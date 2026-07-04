"""Deterministic data layer for the KPI Commentary Tool Agent.

This module is the *only* place numbers come from. The language models never
compute a figure; they write a SELECT, this layer executes it against DuckDB,
and the real result is returned. That is what makes "numbers are always
correct" true.

Design choices that matter for production portability:
- The book is loaded into DuckDB, which is a drop-in stand-in for a real SQL
  warehouse. Swapping to Snowflake/BigQuery/Databricks later means changing
  `load_book()` to open a warehouse connection instead of reading a file; the
  agent's SQL and the rest of the system are unchanged.
- Column names are sanitised to snake_case so generated SQL is clean and the
  model doesn't have to quote awkward identifiers like "Exposure & Other
  Change". A name map is exposed in the schema so the original labels are
  still discoverable.
"""
from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import duckdb
import pandas as pd

from . import config

# --------------------------------------------------------------------------
# Connection management (lazy singleton, thread-safe enough for the POC REPL)
# --------------------------------------------------------------------------
_lock = threading.Lock()
_con: duckdb.DuckDBPyConnection | None = None
_column_map: dict[str, str] = {}   # original label -> sql name
_reverse_map: dict[str, str] = {}  # sql name -> original label


def _sanitise(name: str) -> str:
    """Turn an arbitrary column label into a safe snake_case SQL identifier."""
    s = name.strip().lower()
    s = re.sub(r"[^0-9a-z]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        s = "col"
    if s[0].isdigit():
        s = f"c_{s}"
    return s


def _read_source(path: str) -> pd.DataFrame:
    if path.lower().endswith((".xlsx", ".xls")):
        return pd.read_excel(path)
    if path.lower().endswith(".csv"):
        return pd.read_csv(path)
    raise ValueError(f"Unsupported data source: {path!r}. Use .xlsx, .xls or .csv.")


def read_dataframe_from_upload(filename: str, content: bytes) -> pd.DataFrame:
    """Parse an uploaded spreadsheet into a DataFrame."""
    import io

    buf = io.BytesIO(content)
    lower = filename.lower()
    if lower.endswith((".xlsx", ".xls")):
        return pd.read_excel(buf)
    if lower.endswith(".csv"):
        return pd.read_csv(buf)
    raise ValueError(f"Unsupported upload: {filename!r}. Use .xlsx, .xls or .csv.")


def reload_book(df: pd.DataFrame) -> dict[str, Any]:
    """Replace the in-memory DuckDB table with a new DataFrame."""
    global _con
    with _lock:
        _con = None
    load_book(df=df)
    return get_schema()


def load_book(df: pd.DataFrame | None = None) -> duckdb.DuckDBPyConnection:
    """Load the policy book into DuckDB once and return the connection.

    Pass `df` directly (used by tests) or leave it None to read config.DATA_PATH.
    Production: replace the body with a warehouse connection that exposes the
    same `config.TABLE_NAME` table.
    """
    global _con, _column_map, _reverse_map
    with _lock:
        if _con is not None and df is None:
            return _con

        if df is None:
            df = _read_source(config.DATA_PATH)

        # Build the column map and rename to snake_case for clean SQL.
        _column_map = {orig: _sanitise(orig) for orig in df.columns}
        # Guard against collisions after sanitising.
        seen: dict[str, int] = {}
        for orig, snake in list(_column_map.items()):
            if snake in seen:
                seen[snake] += 1
                _column_map[orig] = f"{snake}_{seen[snake]}"
            else:
                seen[snake] = 0
        _reverse_map = {v: k for k, v in _column_map.items()}

        renamed = df.rename(columns=_column_map)
        con = duckdb.connect(database=":memory:")
        con.register("_src_df", renamed)
        con.execute(
            f'CREATE TABLE "{config.TABLE_NAME}" AS SELECT * FROM _src_df'
        )
        con.unregister("_src_df")
        _con = con
        return _con


# --------------------------------------------------------------------------
# Schema introspection
# --------------------------------------------------------------------------
@dataclass
class ColumnInfo:
    sql_name: str
    label: str
    dtype: str
    categorical_values: list[Any] = field(default_factory=list)


def get_schema() -> dict[str, Any]:
    """Return columns, types, the original->sql name map, and the distinct
    values of low-cardinality columns so the model can map natural-language
    slices ("Financial Lines", "North America") onto real data values.
    """
    con = load_book()
    info = con.execute(f"PRAGMA table_info('{config.TABLE_NAME}')").fetchdf()
    columns: list[dict[str, Any]] = []
    for _, row in info.iterrows():
        sql_name = row["name"]
        dtype = str(row["type"])
        cats: list[Any] = []
        if any(t in dtype.upper() for t in ("VARCHAR", "TEXT", "CHAR", "BOOLEAN")):
            distinct = con.execute(
                f'SELECT DISTINCT "{sql_name}" AS v FROM "{config.TABLE_NAME}" '
                f'WHERE "{sql_name}" IS NOT NULL LIMIT {config.CATEGORICAL_MAX_CARDINALITY + 1}'
            ).fetchdf()["v"].tolist()
            if len(distinct) <= config.CATEGORICAL_MAX_CARDINALITY:
                cats = sorted(map(str, distinct))
        columns.append(
            {
                "sql_name": sql_name,
                "label": _reverse_map.get(sql_name, sql_name),
                "dtype": dtype,
                "categorical_values": cats,
            }
        )
    return {
        "table": config.TABLE_NAME,
        "row_count": con.execute(f'SELECT COUNT(*) FROM "{config.TABLE_NAME}"').fetchone()[0],
        "columns": columns,
    }


# --------------------------------------------------------------------------
# Guarded SQL execution
# --------------------------------------------------------------------------
class SQLGuardError(ValueError):
    """Raised when a query violates the read-only guardrails."""


_LIMIT_RE = re.compile(r"\blimit\s+\d+", re.IGNORECASE)
_TOKEN_RE = re.compile(r"[a-zA-Z_]+")


def _guard(sql: str) -> str:
    """Validate and normalise a query. Returns the safe SQL or raises."""
    cleaned = sql.strip().rstrip(";").strip()
    if not cleaned:
        raise SQLGuardError("Empty query.")

    # Single statement only.
    if ";" in cleaned:
        raise SQLGuardError("Only a single SQL statement is allowed.")

    lowered = cleaned.lower()
    if not lowered.startswith(config.ALLOWED_SQL_PREFIXES):
        raise SQLGuardError("Only read-only SELECT/WITH queries are allowed.")

    tokens = {t.lower() for t in _TOKEN_RE.findall(cleaned)}
    blocked = tokens.intersection(config.BLOCKED_SQL_TOKENS)
    if blocked:
        raise SQLGuardError(f"Query contains blocked keyword(s): {', '.join(sorted(blocked))}.")

    # Enforce a row cap so nothing floods context or dumps the whole book.
    if not _LIMIT_RE.search(cleaned):
        cleaned = f"{cleaned}\nLIMIT {config.MAX_ROWS}"
    return cleaned


@dataclass
class QueryResult:
    sql: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    truncated: bool
    error: str | None = None
    elapsed_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "sql": self.sql,
            "columns": self.columns,
            "rows": self.rows,
            "row_count": self.row_count,
            "truncated": self.truncated,
            "error": self.error,
            "elapsed_ms": self.elapsed_ms,
        }


def run_sql(sql: str) -> QueryResult:
    """Execute a guarded read-only query and return structured results."""
    try:
        safe = _guard(sql)
    except SQLGuardError as e:
        return QueryResult(sql=sql, columns=[], rows=[], row_count=0, truncated=False, error=str(e))

    con = load_book()
    start = time.perf_counter()
    try:
        df = con.execute(safe).fetchdf()
    except Exception as e:  # noqa: BLE001 - surface DB errors to the agent cleanly
        return QueryResult(sql=safe, columns=[], rows=[], row_count=0, truncated=False,
                           error=f"SQL execution error: {e}",
                           elapsed_ms=round((time.perf_counter() - start) * 1000, 1))
    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)

    truncated = len(df) > config.MAX_ROWS
    if truncated:
        df = df.head(config.MAX_ROWS)
    rows = df.to_dict(orient="records")
    return QueryResult(
        sql=safe,
        columns=list(df.columns),
        rows=rows,
        row_count=len(rows),
        truncated=truncated,
        elapsed_ms=elapsed_ms,
    )


# --------------------------------------------------------------------------
# Self-test: exercises the guard and a couple of aggregations against the real
# configured book (config.DATA_PATH). Run: python -m conversational_bi.data_layer
# --------------------------------------------------------------------------
if __name__ == "__main__":
    load_book()  # reads config.DATA_PATH
    schema = get_schema()
    print(f"Loaded {schema['row_count']} rows, {len(schema['columns'])} columns.")
    sql_names = {c["sql_name"] for c in schema["columns"]}
    loss_col = next((c for c in ("priced_loss_ratio", "loss_ratio") if c in sql_names), None)

    if {"segment", "rate_change", "expiry_gwp"} <= sql_names and loss_col:
        print("\n[OK query] premium-weighted rate change by segment:")
        res = run_sql(
            'SELECT segment, '
            'SUM(rate_change * expiry_gwp) / SUM(expiry_gwp) AS wtd_rate_change, '
            f'AVG({loss_col}) AS avg_loss_ratio, COUNT(*) AS n '
            f'FROM "{config.TABLE_NAME}" GROUP BY segment ORDER BY wtd_rate_change'
        )
        for r in res.rows:
            print("  ", r)
        print("   executed SQL ends with LIMIT?:", bool(_LIMIT_RE.search(res.sql)))
    else:
        print("\n(Skipping the segment aggregation self-test: the configured book "
              "does not expose the expected P&C columns.)")

    print("\n[Blocked] DROP attempt:")
    print("  ", run_sql("DROP TABLE policies").error)
    print("[Blocked] multi-statement:")
    print("  ", run_sql("SELECT 1; SELECT 2").error)
    print("[Blocked] non-select:")
    print("  ", run_sql("UPDATE policies SET loss_ratio = 0").error)
