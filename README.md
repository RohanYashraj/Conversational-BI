# KPI Commentary Tool Agent — AgentOS (Agno + Gemini + DuckDB)

A conversational agent over policy-level P&C data. Ask in plain English; get a
**computed** number/table, a chart when it helps, and a 1–3 sentence
explanation grounded in *other* columns of the data. The language model never
produces a number — every figure comes from real SQL run by the data layer.

## Architecture (one team, three specialists)

```
                 ┌──────────────────────────────────────────┐
   user ───────▶ │  BI Orchestrator (team leader, coordinate) │
                 │  • carries the active filter across turns   │
                 │  • routes, then assembles the final answer  │
                 │  tools: get/set_active_filters, default_dashboard
                 └───────┬───────────────┬───────────────┬────┘
                         │               │               │
                  ┌──────▼─────┐  ┌───────▼──────┐  ┌─────▼────────┐
                  │ Query Agent │  │  Viz Agent   │  │ Insight Agent│
                  │ SQL → facts │  │ chart spec   │  │ commentary   │
                  │ tools:      │  │ tools:       │  │ tools: none  │
                  │ describe_   │  │ make_chart_  │  │ (reasons only│
                  │ schema,     │  │ spec         │  │  over given  │
                  │ query_data  │  │              │  │  figures)    │
                  └──────┬──────┘  └──────────────┘  └──────────────┘
                         │ guarded, read-only SQL
                  ┌──────▼───────────────────────────┐
                  │ Data layer (DuckDB)               │
                  │ • SELECT/WITH only, one statement │
                  │ • keyword denylist, row cap       │
                  │ • snake_case schema + categoricals│
                  └───────────────────────────────────┘
```

**Why this shape:** data work lives in *tools*, not extra agents, so the POC
stays fast and debuggable. The three members are each narrow in scope so the
leader can route cleanly and each context stays small.

## Project structure

Organised the way the [agno agent-api template](https://github.com/agno-agi/agent-api)
recommends — by capability, with registries so growth is additive:

```
conversational_bi/
├── agent_os.py        # entry point: thin composition root (Docker CMD target)
├── config.py          # every environment-driven setting in one place
├── data_layer.py      # guarded DuckDB SQL executor + schema introspection
├── glossary.py        # semantic layer: governed metric definitions = the SQL
├── agents/            # member agents, one module each (+ registry __init__)
│   ├── query.py       #   SQL → facts (the only component that touches data)
│   ├── viz.py         #   Vega-Lite chart spec or NO_CHART
│   └── insight.py     #   grounded commentary; deliberately no data access
├── teams/             # teams, one module each; build_all_teams() registry
│   └── bi_team.py     #   the BI orchestrator + session auto-naming hook
├── tools/             # capabilities, one module each (+ re-export __init__)
│   ├── sql.py         #   describe_schema, query_data (guarded)
│   ├── filters.py     #   cross-turn filter context
│   ├── charts.py      #   make_chart_spec
│   ├── bridge.py      #   exact premium bridge + waterfall spec
│   ├── dashboard.py   #   on-load cuts, headline KPIs, briefing
│   ├── anomalies.py   #   deterministic outlier sweep
│   ├── glossary_tool.py # governed definitions lookup
│   ├── provenance.py  #   per-session query log ("Sources" panel)
│   └── formatting.py  #   shared json-safe/format helpers
├── prompts/           # instructions, one module per role (+ __init__)
├── models/            # customised LLM clients (schema-grounded followups)
├── api/               # custom FastAPI routes (/dashboard, /provenance, uploads)
├── db/                # AgentOS DB factory: Neon Postgres (prod) / SQLite (dev)
└── data/              # the demo book (Demo_Policy_Level_Dummy.xlsx)
```

### Extending it

- **New tool** — add a module under `tools/` (one capability per file), export
  it in `tools/__init__.py`, attach it to an agent or team.
- **New agent** — add `agents/<name>.py` with a `build_<name>_agent()` factory,
  export it in `agents/__init__.py`, add a prompt module under `prompts/`, and
  put it on a team (or register it standalone via `AgentOS(agents=[...])`).
- **New team** — add `teams/<name>.py` with a `build_<name>_team(db=...)`
  factory and add one line to `build_all_teams()` in `teams/__init__.py` —
  AgentOS and the UI pick it up automatically.
- **New endpoint** — add it to `api/routes.py` (or a new router module).

## Run it

```bash
pip install -e .
cp .env.example .env          # then set GOOGLE_API_KEY
# put Demo_Policy_Level_Dummy.xlsx in conversational_bi/data/
python -m conversational_bi.agent_os
```

The server starts at `http://localhost:8000`.

| Endpoint | Description |
|---|---|
| `http://localhost:8000/docs` | Interactive API documentation |
| `http://localhost:8000/config` | AgentOS configuration |

### Connect to the control plane

1. Open [os.agno.com](https://os.agno.com) and sign in
2. Click **Add new OS** → **Local**
3. Enter `http://localhost:8000` and connect
4. Chat with the **KPI Commentary Tool** team

Use Chrome or Edge for local connections ([connection FAQ](https://docs.agno.com/faq/agentos-connection)).

### First questions to try

- "Show me the dashboard"
- "What is the weighted rate change by segment?"
- "Now just North America" (follow-up — inherits prior context)

Validate the data layer (no API key needed — runs the guard + aggregation
self-test against the demo book):

```bash
python -m conversational_bi.data_layer
```

## How the guarantees are met

- **Numbers always correct.** `data_layer.run_sql` is the only source of
  figures. The guard rejects anything that isn't a single read-only
  SELECT/WITH, blocks write keywords, and caps rows. The Insight Agent has no
  data tools and is instructed to use only figures it is handed.
- **Commentary cites a second fact.** The Query Agent computes supporting
  metrics (loss ratio, new/renewal mix, account concentration) alongside the
  headline number; the Insight Agent must ground the "why" in one of them.
- **Follow-ups.** The leader reads/writes `active_filters` in session state and
  reuses the same session, so "now just North America" inherits prior context.
- **Default dashboard.** `default_dashboard()` returns the standard cuts on load
  and is also a tool the leader can call.
- **Audit trail.** Every executed query + row count is appended to
  `session_state["audit_log"]`.

## Production swap (BRD §6) — what changes, what doesn't

| Concern | POC today | Production change |
|---|---|---|
| Data source | Excel → DuckDB in-memory | Re-point `data_layer.load_book()` at the warehouse; keep table name `policies`. Agent SQL is unchanged. |
| Scale | 1,200 rows | Precomputed summary tables / warehouse engine; same SQL interface. |
| Refresh | manual file | Scheduled load job. |
| Access control | none | Enforce row/column security at the warehouse role the agent connects as. |
| Multi-tenancy | one file | Per-client connection; logic is schema-generic (no hardcoded values). |
| Audit | in-session log | Persist `audit_log` to a table. |
| Data gaps | guard + "can't answer" | Same behaviour; agents instructed to decline rather than guess. |

> Note on versions: this targets Agno v2.6+ (`agno.os.AgentOS`, `agno.team.Team`,
> `mode="coordinate"`, `agno.models.google.Gemini`, tools as plain functions with
> `RunContext`).
