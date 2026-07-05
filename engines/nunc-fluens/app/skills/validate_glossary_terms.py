"""Validate glossary_terms rows for form, semantic accuracy, and dedupe.

Phase C — glossary stream reinforcement. Spec: ``design/skills/validate-glossary-terms.md``.

Three checks:

* **form** — purely Python, deterministic. Hits empty defs, over-long
  defs (>25 words / >2 sentences), banned-word infiltration into the
  quick_def line (jargon the writer was supposed to avoid).
* **semantic** — LLM-as-judge. The orchestrator hands each (term,
  quick_def, why_it_matters) tuple to the writer's LLM context
  with the prompt template in the skill spec; the LLM returns
  ``{"verdict": "match|mismatch|uncertain", "reason": ..., "suggested_fix": ...}``.
  ``commit_validation()`` writes that to ``glossary_audit`` and, on
  ``mismatch``, retires the row with ``reviewed_by_human=1``
  (so the auto-retire loop doesn't keep flapping it).
* **dedupe** — purely Python. Detects when a fresh active term is a
  case-insensitive substring or alias-overlap of another active term
  and flags the shorter one for retirement. Conservative — only fires
  when the overlap is unambiguous.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sqlite3
import sys
from pathlib import Path


# Words that should not appear inside a quick_def sentence — these are
# the jargon the line is supposed to translate AWAY from. The list is
# intentionally narrow: too aggressive a list and every legitimate AI
# definition would trip.
_FORBIDDEN_IN_QUICK_DEF = frozenset(
    {
        "leverage", "synergy", "paradigm", "ecosystem",  # corporate noise
        "utilize", "facilitate",                         # use 'use' / 'help'
        "stochastic", "heuristic", "asymptotic",         # not 14-yr friendly
        # add as needed; intentionally short
    }
)

# Words that signal the term itself is generic English, not a proper
# noun / acronym worthy of a glossary entry. Used by the form check
# when the row's `term` column itself looks generic.
_GENERIC_TERM_WORDS = frozenset(
    {
        "today", "yesterday", "tomorrow", "future", "past",
        "news", "summary", "headlines", "report",
        "team", "company", "user", "users",
        "thing", "stuff", "issue", "case",
    }
)


def _word_count(s: str) -> int:
    return len(re.findall(r"\S+", s or ""))


def _sentence_count(s: str) -> int:
    if not s:
        return 0
    return len([p for p in re.split(r"(?<=[.!?])\s+", s.strip()) if p])


# ---------------------------------------------------------------------------
# Form check (Python only)
# ---------------------------------------------------------------------------


def form_check(row: dict) -> dict:
    """Run the form-check on one row. Returns one verdict dict.

    Verdict shape: {"check_type": "form", "verdict": "...", "reason": "...",
                    "suggested_fix": "..." (optional)}
    """
    term = (row.get("term") or "").strip()
    qd = (row.get("quick_def") or "").strip()
    why = (row.get("why_it_matters") or "").strip()
    issues: list[str] = []

    if not term:
        return {"check_type": "form", "verdict": "fail",
                "reason": "term is empty"}

    if term.lower() in _GENERIC_TERM_WORDS:
        issues.append(f"term {term!r} looks like a generic English word, not a proper noun / acronym")

    if not qd:
        return {"check_type": "form", "verdict": "fail",
                "reason": "quick_def is empty"}

    qd_words = _word_count(qd)
    if qd_words > 25:
        issues.append(f"quick_def is {qd_words} words (cap 25)")
    qd_sentences = _sentence_count(qd)
    if qd_sentences > 2:
        issues.append(f"quick_def has {qd_sentences} sentences (cap 2)")

    qd_lower = qd.lower()
    forbidden_hits = [w for w in _FORBIDDEN_IN_QUICK_DEF if re.search(rf"\b{re.escape(w)}\b", qd_lower)]
    if forbidden_hits:
        issues.append(f"quick_def contains forbidden jargon: {forbidden_hits}")

    if why:
        why_words = _word_count(why)
        if why_words > 30:
            issues.append(f"why_it_matters is {why_words} words (cap 30)")

    if not issues:
        return {"check_type": "form", "verdict": "pass", "reason": ""}
    # `fail` if the term is generic OR the quick_def has hard-blockers;
    # otherwise `warn`.
    blocking = any("generic English" in i or "forbidden jargon" in i for i in issues)
    return {
        "check_type": "form",
        "verdict": "fail" if blocking else "warn",
        "reason": "; ".join(issues),
    }


# ---------------------------------------------------------------------------
# Dedupe check (Python only — conservative)
# ---------------------------------------------------------------------------


def dedupe_check(conn: sqlite3.Connection, row: dict) -> dict:
    """Flag a row whose term + alias set is fully covered by an existing
    older active term. Conservative: only fires on exact case-insensitive
    overlap (term equals an alias of another row, or aliases overlap by
    ≥ 1 token AND the term is a substring of the other term).
    """
    term = (row.get("term") or "").strip()
    if not term:
        return {"check_type": "dedupe", "verdict": "pass", "reason": ""}
    aliases = []
    raw_aliases = row.get("aliases_json") or "[]"
    try:
        a = json.loads(raw_aliases)
        if isinstance(a, list):
            aliases = [str(x).strip() for x in a if x]
    except (json.JSONDecodeError, TypeError):
        aliases = []
    own = {term.lower(), *(a.lower() for a in aliases)}
    cur = conn.execute(
        """
        SELECT term, aliases_json FROM glossary_terms
         WHERE status = 'active' AND term <> ?
        """,
        (term,),
    )
    for other in cur.fetchall():
        other_term = other["term"]
        other_aliases = []
        try:
            o = json.loads(other["aliases_json"] or "[]")
            if isinstance(o, list):
                other_aliases = [str(x).strip() for x in o if x]
        except (json.JSONDecodeError, TypeError):
            pass
        other_set = {other_term.lower(), *(a.lower() for a in other_aliases)}
        # If our term is in their alias set OR fully overlaps, flag.
        if term.lower() in other_set:
            return {
                "check_type": "dedupe",
                "verdict": "fail",
                "reason": f"term {term!r} is already an alias of active term {other_term!r}",
                "suggested_fix": f"retire and add to {other_term!r} aliases_json",
            }
        if own & other_set and len(other_term) > len(term) and term.lower() in other_term.lower():
            return {
                "check_type": "dedupe",
                "verdict": "warn",
                "reason": f"term {term!r} overlaps with longer active term {other_term!r}",
                "suggested_fix": f"consider merging into {other_term!r}",
            }
    return {"check_type": "dedupe", "verdict": "pass", "reason": ""}


# ---------------------------------------------------------------------------
# Pending semantic checks — surface terms the LLM-as-judge needs to look at
# ---------------------------------------------------------------------------


def list_pending_semantic(conn: sqlite3.Connection, *, limit: int = 25) -> list[dict]:
    """Return active rows that haven't had a passing semantic audit yet."""
    cur = conn.execute(
        """
        SELECT t.term, t.aliases_json, t.quick_def, t.why_it_matters,
               t.canonical_link
          FROM glossary_terms t
         WHERE t.status = 'active'
           AND t.quick_def IS NOT NULL
           AND t.reviewed_by_human = 0
           AND NOT EXISTS (
             SELECT 1 FROM glossary_audit a
              WHERE a.term = t.term
                AND a.check_type = 'semantic'
                AND a.verdict IN ('pass', 'fail')
           )
         ORDER BY t.term
         LIMIT ?
        """,
        (limit,),
    )
    return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Audit log + auto-retire
# ---------------------------------------------------------------------------


def commit_validation(
    conn: sqlite3.Connection,
    *,
    term: str,
    verdicts: list[dict],
) -> None:
    """Write each verdict to glossary_audit. If any verdict is 'fail',
    flip the row to status='retired' and reviewed_by_human=1 (so the
    auto-retire-quiet loop in define-glossary-terms doesn't churn on
    it again next run)."""
    today = dt.date.today().isoformat()
    has_fail = False
    for v in verdicts:
        conn.execute(
            """
            INSERT INTO glossary_audit (term, check_type, verdict, reason, suggested_fix, checked_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                term,
                v.get("check_type", "form"),
                v.get("verdict", "pass"),
                v.get("reason"),
                v.get("suggested_fix"),
                today,
            ),
        )
        if v.get("verdict") == "fail":
            has_fail = True
    if has_fail:
        conn.execute(
            """
            UPDATE glossary_terms
               SET status = 'retired',
                   reviewed_by_human = 1,
                   updated_at = ?
             WHERE term = ?
            """,
            (today, term),
        )
    conn.commit()


def run(db_path: Path, *, limit: int) -> dict:
    if not db_path.is_file():
        raise FileNotFoundError(f"DB not found: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(
            """
            SELECT term, aliases_json, quick_def, why_it_matters, canonical_link
              FROM glossary_terms
             WHERE status = 'active'
             ORDER BY term
             LIMIT ?
            """,
            (limit,),
        )
        rows = [dict(r) for r in cur.fetchall()]
        results: list[dict] = []
        retired: list[str] = []
        warns: list[str] = []
        for row in rows:
            verdicts = [
                form_check(row),
                dedupe_check(conn, row),
            ]
            commit_validation(conn, term=row["term"], verdicts=verdicts)
            for v in verdicts:
                if v["verdict"] == "fail":
                    retired.append(row["term"])
                    break
            else:
                if any(v["verdict"] == "warn" for v in verdicts):
                    warns.append(row["term"])
            results.append({"term": row["term"], "verdicts": verdicts})
        pending_semantic = [r["term"] for r in list_pending_semantic(conn, limit=limit)]
    finally:
        conn.close()
    return {
        "checked": len(rows),
        "retired_by_form_or_dedupe": retired,
        "warned": warns,
        "pending_semantic_count": len(pending_semantic),
        "pending_semantic": pending_semantic,
        "results": results,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Validate active glossary terms (form + dedupe + queue semantic)")
    p.add_argument("--db", required=True, type=Path)
    p.add_argument("--limit", type=int, default=200)
    args = p.parse_args(argv)
    try:
        out = run(args.db, limit=args.limit)
    except FileNotFoundError as e:
        print(f"FAIL {e}", file=sys.stderr)
        return 2
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
