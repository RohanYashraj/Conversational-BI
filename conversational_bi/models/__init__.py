"""Model wrappers: customised LLM clients used alongside the plain Gemini
model from config (e.g. the schema-grounded followup generator)."""
from .followups import GroundedFollowupGemini

__all__ = ["GroundedFollowupGemini"]
