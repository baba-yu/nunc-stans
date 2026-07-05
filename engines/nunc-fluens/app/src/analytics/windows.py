"""Date-window helpers."""

from __future__ import annotations

from datetime import date, datetime, timedelta


WINDOWS: tuple[tuple[str, int], ...] = (
    ("7d", 7),
    ("30d", 30),
    ("90d", 90),
)


def parse_iso_date(text: str) -> date:
    """Parse ``YYYY-MM-DD`` into a ``date``."""
    return datetime.strptime(text, "%Y-%m-%d").date()


def window_range(latest: date, days: int) -> tuple[date, date]:
    """Return ``(start, end)`` inclusive for a window ending at ``latest``.

    ``end`` = latest; ``start`` = latest - (days - 1) so the window covers
    exactly ``days`` calendar days.
    """
    start = latest - timedelta(days=days - 1)
    return start, latest


def within(target: date, start: date, end: date) -> bool:
    return start <= target <= end


def age_days(target: date, reference: date) -> int:
    return (reference - target).days
