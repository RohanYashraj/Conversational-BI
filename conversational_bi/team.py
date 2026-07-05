"""The BI Orchestrator team.

A coordinate-mode team: the leader owns the conversation, carries the active
filter forward, delegates computation/visualisation/commentary to the three
member agents, and assembles the final answer. Numbers only ever come from the
Query Agent's tools.
"""
from __future__ import annotations

from agno.db.sqlite import SqliteDb
from agno.team import Team
from agno.team.mode import TeamMode
from agno.tools.reasoning import ReasoningTools

from . import config, prompts
from .agents import build_insight_agent, build_query_agent, build_viz_agent
from .tools import (
    default_dashboard,
    find_anomalies,
    get_active_filters,
    lookup_glossary,
    premium_bridge,
    set_active_filters,
)


def _autoname_session(team: Team, session, run_output=None) -> None:
    """Post-run hook: name new sessions from the conversation using agno's
    native autogenerate (Team.set_session_name). Runs once per session — after
    the first exchange — and never overwrites a name that already exists
    (including manual renames). Registered as a background hook so it adds no
    latency to the answer stream."""
    from agno.models.message import Message
    from agno.utils.log import log_debug, log_exception

    session_data = getattr(session, "session_data", None) or {}
    if session_data.get("session_name"):
        return
    try:
        # Same recipe as agno's Team.generate_session_name, with two fixes:
        # work on the session object the hook receives (set_session_name
        # re-reads from the DB and races the deferred store when hooks run in
        # the background), and name from the user/assistant exchange only —
        # the stock helper includes the system prompt, which drowns out the
        # question and yields generic titles like "Team Collaboration Session".
        # The session object handed to background hooks does not yet expose
        # this run's messages — the just-completed exchange lives on
        # run_output. Fall back to the stored session history if needed.
        messages = [
            m
            for m in (getattr(run_output, "messages", None) or [])
            if m.role in ("user", "assistant")
        ]
        if not messages:
            messages = session.get_messages(
                skip_roles=["system", "tool"], skip_history_messages=False
            )
        convo = "\n".join(
            f"{m.role.upper()}: {str(m.content)[:500]}"
            for m in messages
            if m.content
        )
        if not convo:
            return
        response = team.model.response(  # type: ignore[union-attr]
            messages=[
                Message(
                    role="system",
                    content=(
                        "Provide a concise, specific title for this "
                        "conversation in at most 5 words. Return only the "
                        "title, no quotes or punctuation."
                    ),
                ),
                Message(role="user", content=f"{convo}\n\nConversation Name: "),
            ]
        )
        name = (response.content or "").replace('"', "").strip()
        if not name or len(name.split()) > 8:
            return
        session.session_data = {**session_data, "session_name": name}
        team.save_session(session=session)
        log_debug(f"Auto-named session {session.session_id}: {name!r}")
    except Exception:  # noqa: BLE001 - naming is cosmetic, never break a run
        log_exception("Session auto-naming failed")


def build_bi_team(*, db: SqliteDb) -> Team:
    """Construct the orchestrator team registered with AgentOS."""
    # Leader tools. With reasoning on, ReasoningTools lets the orchestrator
    # think in visible steps (streamed to the UI) before/while it delegates —
    # our own Gemini model drives it, so it stays model-agnostic and inside
    # the AgentOS framework.
    leader_tools = [
        get_active_filters,
        set_active_filters,
        default_dashboard,
        premium_bridge,
        lookup_glossary,
        find_anomalies,
    ]
    if config.REASONING_ENABLED:
        leader_tools.insert(0, ReasoningTools(add_instructions=True))

    return Team(
        id="conversational-bi",
        name="KPI Commentary Tool",
        description=(
            "P&C portfolio Q&A with guarded SQL, charts, and grounded commentary. "
            "Numbers always come from executed queries, never from the model."
        ),
        model=config.gemini_model(),
        members=[
            build_query_agent(),
            build_viz_agent(),
            build_insight_agent(),
        ],
        mode=TeamMode.coordinate,
        tools=leader_tools,
        instructions=prompts.ORCHESTRATOR,
        session_state={"active_filters": {}, "audit_log": []},
        db=db,
        add_history_to_context=True,
        # Filters are carried forward by our own get/set_active_filters tools
        # plus conversation history — we don't need Agno's built-in agentic
        # state tool, which also emits a noisy arg-parse warning at startup.
        enable_agentic_state=False,
        markdown=True,
        # Agno's native follow-up suggestions: after each answer the team
        # generates short next-question prompts (streamed to the UI as a
        # TeamFollowupsCompleted event and rendered as clickable chips).
        # The dedicated followup_model grounds them in the live schema so they
        # only suggest questions this book can actually answer.
        followups=config.FOLLOWUPS_ENABLED,
        num_followups=config.NUM_FOLLOWUPS,
        followup_model=config.followup_model(),
        # Auto-title new sessions from the conversation (agno-native).
        post_hooks=[_autoname_session],
    )
