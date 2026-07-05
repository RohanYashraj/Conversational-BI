"""Team definitions, one module per team.

Adding a team: create a module here with a build_<name>_team(db=...) factory,
then add it to build_all_teams below — AgentOS picks it up automatically.
"""
from __future__ import annotations

from agno.team import Team

from .bi_team import build_bi_team


def build_all_teams(*, db) -> list[Team]:
    """Every team registered with AgentOS. New teams: one line here."""
    return [
        build_bi_team(db=db),
    ]


__all__ = ["build_all_teams", "build_bi_team"]
