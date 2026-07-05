"""Glossary tool (Orchestrator): governed metric definitions, answered
verbatim from the semantic layer in conversational_bi.glossary."""
from __future__ import annotations

import json

from .. import glossary


def lookup_glossary(term: str = "") -> str:
    """Look up the governed business definition of a metric: what it means and
    how it is calculated. Use this whenever the user asks "what is X?" or "how
    is X calculated?" for terms like premium, weighted rate change, loss ratio,
    retention, premium bridge, or exposure change. Pass an empty term to list
    the whole glossary. Answer strictly from what this returns — never invent
    a definition.
    """
    return json.dumps(glossary.lookup(term), indent=2)
