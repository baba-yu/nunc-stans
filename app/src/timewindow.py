"""Parse natural-language time expressions into (start_date, end_date) tuples.

Used by the Phase 3 backfill + writer-side persistence to convert
free-text time references like "Q3 2026", "mid-May 2026", or
"May 5-15 2026" into structured ISO-date bounds.

Returns ``(None, None)`` when no recognizable time expression is found —
the caller is expected to leave the target_*_date columns NULL in that
case rather than guessing.

The parser is conservative by design: it errs on the side of NULL when
ambiguous, because a wrong timestamp is worse than no timestamp for
downstream aggregation (cluster windows, READINGS chain dates, etc.).
"""

from __future__ import annotations

import calendar
import re
from datetime import date, timedelta
from typing import Optional

# ============================================================
# Pattern table — order matters (more specific patterns first).
# ============================================================

_MONTH = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}
_MONTH_PAT = "|".join(_MONTH.keys())

# Quarter / half-year (e.g. "Q3 2026", "2026 Q3", "H2 2026")
_QUARTER_RE = re.compile(
    r"\bQ([1-4])\s*(20\d{2})\b|\b(20\d{2})\s*Q([1-4])\b",
    re.IGNORECASE,
)
_HALF_RE = re.compile(
    r"\bH([12])\s*(20\d{2})\b|\b(20\d{2})\s*H([12])\b",
    re.IGNORECASE,
)

# Specific date (ISO or "May 8 2026" / "May 8, 2026")
_ISO_DATE_RE = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")
_LONG_DATE_RE = re.compile(
    rf"\b({_MONTH_PAT})\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(20\d{{2}})\b",
    re.IGNORECASE,
)

# Date range like "May 5-15 2026" or "May 5–15, 2026"
_DATE_RANGE_RE = re.compile(
    rf"\b({_MONTH_PAT})\s+(\d{{1,2}})\s*[-–—]\s*(\d{{1,2}})(?:,)?\s+(20\d{{2}})\b",
    re.IGNORECASE,
)

# Modifier + month + year ("mid-May 2026", "early May 2026", "late May 2026")
_MOD_MONTH_RE = re.compile(
    rf"\b(early|mid|late)[\s-]({_MONTH_PAT})\s+(20\d{{2}})\b",
    re.IGNORECASE,
)

# Bare month + year ("May 2026", "2026-05")
_MONTH_YEAR_RE = re.compile(
    rf"\b({_MONTH_PAT})\s+(20\d{{2}})\b|\b(20\d{{2}})-(\d{{2}})\b(?!-)",
    re.IGNORECASE,
)

# "by [Q3 2026]" / "before [date]" — strip the prefix and re-parse.
_BY_PREFIX_RE = re.compile(r"\b(by|before|until|in)\s+", re.IGNORECASE)


def _last_day(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _quarter_bounds(year: int, q: int) -> tuple[date, date]:
    start_month = (q - 1) * 3 + 1
    end_month = start_month + 2
    return (date(year, start_month, 1),
            date(year, end_month, _last_day(year, end_month)))


def _half_bounds(year: int, h: int) -> tuple[date, date]:
    if h == 1:
        return (date(year, 1, 1), date(year, 6, 30))
    return (date(year, 7, 1), date(year, 12, 31))


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    return (date(year, month, 1),
            date(year, month, _last_day(year, month)))


def _modifier_bounds(year: int, month: int, modifier: str) -> tuple[date, date]:
    """early/mid/late within a month: 1-10, 11-20, 21-end."""
    last = _last_day(year, month)
    m = modifier.lower()
    if m == "early":
        return (date(year, month, 1), date(year, month, min(10, last)))
    if m == "mid":
        return (date(year, month, 11), date(year, month, min(20, last)))
    if m == "late":
        return (date(year, month, 21), date(year, month, last))
    return _month_bounds(year, month)


def parse_time_window(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse a free-text time expression into (start, end) ISO date strings.

    Returns ``(None, None)`` when no recognizable expression is found.
    """
    if not text:
        return None, None
    s = text.strip()

    # Strip leading prepositions like "by Q3 2026" → "Q3 2026"
    s = _BY_PREFIX_RE.sub("", s)

    # 1. Date range "May 5-15 2026"
    m = _DATE_RANGE_RE.search(s)
    if m:
        try:
            month = _MONTH[m.group(1).lower()]
            year = int(m.group(4))
            d1 = int(m.group(2))
            d2 = int(m.group(3))
            return (date(year, month, d1).isoformat(),
                    date(year, month, d2).isoformat())
        except (ValueError, KeyError):
            pass

    # 2. ISO date
    m = _ISO_DATE_RE.search(s)
    if m:
        try:
            d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            return d.isoformat(), d.isoformat()
        except ValueError:
            pass

    # 3. "May 8 2026" / "May 8, 2026"
    m = _LONG_DATE_RE.search(s)
    if m:
        try:
            month = _MONTH[m.group(1).lower()]
            day = int(m.group(2))
            year = int(m.group(3))
            d = date(year, month, day)
            return d.isoformat(), d.isoformat()
        except (ValueError, KeyError):
            pass

    # 4. Quarter
    m = _QUARTER_RE.search(s)
    if m:
        if m.group(1):
            q = int(m.group(1)); year = int(m.group(2))
        else:
            q = int(m.group(4)); year = int(m.group(3))
        a, b = _quarter_bounds(year, q)
        return a.isoformat(), b.isoformat()

    # 5. Half-year
    m = _HALF_RE.search(s)
    if m:
        if m.group(1):
            h = int(m.group(1)); year = int(m.group(2))
        else:
            h = int(m.group(4)); year = int(m.group(3))
        a, b = _half_bounds(year, h)
        return a.isoformat(), b.isoformat()

    # 6. early/mid/late + month + year
    m = _MOD_MONTH_RE.search(s)
    if m:
        try:
            modifier = m.group(1)
            month = _MONTH[m.group(2).lower()]
            year = int(m.group(3))
            a, b = _modifier_bounds(year, month, modifier)
            return a.isoformat(), b.isoformat()
        except (ValueError, KeyError):
            pass

    # 7. Bare month/year ("May 2026" or "2026-05")
    m = _MONTH_YEAR_RE.search(s)
    if m:
        try:
            if m.group(1):
                month = _MONTH[m.group(1).lower()]
                year = int(m.group(2))
            else:
                year = int(m.group(3))
                month = int(m.group(4))
            a, b = _month_bounds(year, month)
            return a.isoformat(), b.isoformat()
        except (ValueError, KeyError):
            pass

    return None, None


def parse_week_bucket(week_bucket: str) -> tuple[Optional[str], Optional[str]]:
    """Parse a `%Y-%W` ISO-week bucket into (Mon, Sun) ISO dates.

    Used by READINGS to give cluster entries an explicit start/end
    date pair — the frontend then has consistent time fields across
    all of {prediction, need, task, bridge, cluster}.
    """
    if not week_bucket or "-" not in week_bucket:
        return None, None
    try:
        year_str, week_str = week_bucket.split("-", 1)
        year = int(year_str)
        week = int(week_str)
    except (ValueError, TypeError):
        return None, None
    try:
        # ISO week: Monday is day 1. Python's %W treats Monday as the
        # first day of week 0 (start-of-year strict). Use isocalendar
        # equivalence: week 1 contains the first Thursday.
        monday = date.fromisocalendar(year, max(week, 1), 1)
    except (ValueError, AttributeError):
        # Fallback: approximate via day-of-year arithmetic.
        try:
            jan1 = date(year, 1, 1)
            offset = (7 - jan1.weekday()) % 7
            monday = jan1 + timedelta(days=offset + (week - 1) * 7)
        except ValueError:
            return None, None
    sunday = monday + timedelta(days=6)
    return monday.isoformat(), sunday.isoformat()
