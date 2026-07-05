"""Unit tests for scoring formulas."""

from __future__ import annotations

import pytest

from src.analytics.scoring import (
    attention_score,
    clamp,
    continuing_signal_from_sum,
    grass_level,
    new_signal_from_sum,
    normalize_relevance,
    prediction_status,
    realization_score,
    theme_status,
)


def test_clamp():
    assert clamp(-0.1) == 0.0
    assert clamp(1.5) == 1.0
    assert clamp(0.5) == 0.5


def test_new_signal_from_sum():
    # Saturates at sum = 3.0
    assert new_signal_from_sum(0.0) == 0.0
    assert new_signal_from_sum(1.5) == pytest.approx(0.5)
    assert new_signal_from_sum(3.0) == 1.0
    assert new_signal_from_sum(6.0) == 1.0  # clamped


def test_continuing_signal_from_sum():
    # Needs more sum to saturate (5.0)
    assert continuing_signal_from_sum(0.0) == 0.0
    assert continuing_signal_from_sum(2.5) == pytest.approx(0.5)
    assert continuing_signal_from_sum(5.0) == 1.0
    assert continuing_signal_from_sum(10.0) == 1.0


def test_attention_score_formula():
    assert attention_score(0.0, 0.0) == 0.0
    assert attention_score(0.4, 0.4) == pytest.approx(0.6)
    assert attention_score(0.8, 0.8) == 1.0  # clipped
    assert attention_score(1.0, 1.0) == 1.0


def test_realization_score_formula():
    # 0.65 * new + 0.35 * cont, no contradiction term anymore.
    assert realization_score(1.0, 1.0) == 1.0
    assert realization_score(0.0, 0.0) == 0.0
    assert realization_score(0.5, 0.5) == pytest.approx(0.5)
    assert realization_score(1.0, 0.0) == pytest.approx(0.65)
    assert realization_score(0.0, 1.0) == pytest.approx(0.35)


def test_grass_level_breakpoints():
    assert grass_level(0.0) == 0
    assert grass_level(0.05) == 0
    assert grass_level(0.06) == 1
    assert grass_level(0.25) == 1
    assert grass_level(0.26) == 2
    assert grass_level(0.5) == 2
    assert grass_level(0.75) == 3
    assert grass_level(0.76) == 4
    assert grass_level(1.0) == 4


def test_theme_status_logic():
    # new: first_seen + high attention
    assert theme_status(0.6, 0.1, first_seen=True) == "new"
    # active: attention and realization both strong
    assert theme_status(0.6, 0.5) == "active"
    # continuing: moderate attention, low realization
    assert theme_status(0.4, 0.1) == "continuing"
    # dormant: nothing
    assert theme_status(0.1, 0.1) == "dormant"


def test_prediction_status_logic():
    assert prediction_status(0.75) == "supported"
    assert prediction_status(0.5) == "weakly_supported"
    assert prediction_status(0.1) == "no_signal"


def test_normalize_relevance():
    assert normalize_relevance(None) == 0.0
    assert normalize_relevance(1) == pytest.approx(0.2)
    assert normalize_relevance(3) == pytest.approx(0.6)
    assert normalize_relevance(5) == pytest.approx(1.0)
