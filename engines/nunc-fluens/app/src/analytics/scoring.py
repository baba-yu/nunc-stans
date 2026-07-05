"""Pure scoring functions.

Model (post-redesign, informed by empirical data + user feedback):

* Contradiction as a separate signal is gone. Real counter-evidence is
  rare; "a prediction didn't play out" is already captured by a low
  ``realization_score``, so we don't need a second axis.
* ``attention_score`` reflects *frequency × relevance* of evidence —
  taking ``max`` over rows loses count information, which was the main
  reason the old dashboard saturated everything at 1.0 after one hit.
* ``realization_score`` is the weighted mean of (normalized) observed
  relevance, split new / continuing per the user's "直近レポートで再度
  話題に上がったものは加点したい" requirement.
"""

from __future__ import annotations

import math


# The new/continuing saturators. See ``new_signal_from_sum`` /
# ``continuing_signal_from_sum`` for the rationale.
NEW_SIGNAL_SATURATION = 3.0      # sum of normalized relevances that saturates attention
CONTINUING_SIGNAL_SATURATION = 5.0


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    if value < lo:
        return lo
    if value > hi:
        return hi
    return value


def normalize_relevance(relevance: int | None) -> float:
    """Map 1..5 → 0.2..1.0; ``None`` → 0.0."""
    if relevance is None:
        return 0.0
    r = max(1, min(5, int(relevance)))
    return r / 5.0


# ---------------------------------------------------------------------------
# Per-window aggregates
# ---------------------------------------------------------------------------


def new_signal_from_sum(total_new_relevance: float) -> float:
    """Saturate the accumulated new-evidence relevance.

    Rationale: one relevance-5 hit is strong signal but not the whole
    story. Three hits with relevance 5 each — OR five hits with relevance
    3 — should read as "the topic dominates this window". So we map the
    *sum* of normalized relevances onto ``[0, 1]`` through a simple cap.
    """
    if total_new_relevance <= 0:
        return 0.0
    return clamp(total_new_relevance / NEW_SIGNAL_SATURATION, 0.0, 1.0)


def continuing_signal_from_sum(total_cont_relevance: float) -> float:
    """Same shape as ``new_signal_from_sum`` but needs more to saturate.

    Continuing mentions are weaker individually (they're re-assertions,
    not fresh observations), so we stretch the saturator.
    """
    if total_cont_relevance <= 0:
        return 0.0
    return clamp(total_cont_relevance / CONTINUING_SIGNAL_SATURATION, 0.0, 1.0)


def attention_score(new_signal: float, continuing_signal: float) -> float:
    """``min(1, new + 0.5 * continuing)`` — PRD §6.4, unchanged."""
    return clamp(new_signal + 0.5 * continuing_signal, 0.0, 1.0)


def realization_score(
    mean_new_relevance: float,
    mean_continuing_relevance: float,
) -> float:
    """Weighted mean of observed relevance.

    No contradiction term — if a prediction isn't landing, its relevance
    stays low and this score falls with it. See module docstring.
    """
    raw = 0.65 * mean_new_relevance + 0.35 * mean_continuing_relevance
    return clamp(raw, 0.0, 1.0)


def grass_level(attention: float) -> int:
    """0..4 per PRD §6.6."""
    if attention <= 0.05:
        return 0
    if attention <= 0.25:
        return 1
    if attention <= 0.50:
        return 2
    if attention <= 0.75:
        return 3
    return 4


# ---------------------------------------------------------------------------
# Status enums
# ---------------------------------------------------------------------------


def theme_status(
    attention: float,
    realization: float,
    *,
    first_seen: bool = False,
) -> str:
    """new / active / continuing / dormant.

    "contradicted" and "mixed" have been retired along with the
    contradiction axis.
    """
    if first_seen and attention >= 0.5:
        return "new"
    if attention >= 0.5 and realization >= 0.5:
        return "active"
    if attention >= 0.3:
        return "continuing"
    return "dormant"


def prediction_status(realization: float) -> str:
    """supported / weakly_supported / no_signal."""
    if realization >= 0.70:
        return "supported"
    if realization >= 0.40:
        return "weakly_supported"
    return "no_signal"
