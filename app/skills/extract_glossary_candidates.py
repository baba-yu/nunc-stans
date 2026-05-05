"""Extract glossary candidates from a news file (glossary stream — Phase 1).

Scans `report/en/news-YYYYMMDD.md` (the day's canonical EN report) for
proper nouns, acronyms, and technical terms that aren't already in
`glossary_terms`. Adds new candidate rows and bumps the daily
occurrence ledger so `define-glossary-terms` can promote them later.

Skill spec: `design/skills/extract-glossary-candidates.md`.

Usage:
    python -m app.skills.extract_glossary_candidates \\
        --news-file report/en/news-20260502.md \\
        --db        app/data/analytics.sqlite \\
        --seed-yaml reference/glossary.yml

  Default `--seed-mode insert` only adds new terms; pass
  `--seed-mode upsert` to also overwrite existing rows' definitions
  from the YAML (DB-managed counters and dates are preserved).

Exit 0 on success. Prints a summary of new candidates + bumped occurrences.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

# Tokens that must be filtered out — common English words that
# happen to start with a capital letter (sentence beginnings) or
# scope prefixes the writer uses. Kept in lowercase; the matcher
# casefolds before checking.
_STOPWORDS: frozenset[str] = frozenset(
    """
    the and but for not nor with this that these those have has had
    will would shall should can could may might must do does did
    today yesterday tomorrow then now monday tuesday wednesday thursday
    friday saturday sunday january february march april may june
    july august september october november december summary headlines
    future change log news tech business mix non-tech ai api ui js
    note paalala nota important the openclaw nemoclaw hermes
    """.split()
)

# Token shapes we treat as candidate technical terms:
#   • All-caps acronym 2-12 chars: MCP, CNA, KV, ATT&CK, CVSS
#   • Mixed-case proper noun, length ≥ 4, with at least one uppercase: TurboQuant, Anthropic
#   • Hyphen / dot bridged: KV-cache, MITRE-CNA, llama.cpp
# We deliberately do NOT match plain capitalized words like "Today"
# or sentence-leading "The" — those are filtered against _STOPWORDS.
_TOKEN_RE = re.compile(
    r"\b("
    r"[A-Z]{2,12}(?:&[A-Z]{1,8})?"          # MCP, ATT&CK
    r"|[A-Z][a-z]+[A-Z][A-Za-z0-9]+"         # TurboQuant, KubeFlow
    r"|[A-Z]{2,}[\-\.][A-Za-z0-9\-\.]+"      # MITRE-CNA, CVE-2026-…
    r"|[a-z]+\.[a-z]+(?:\.[a-z]+)?"          # llama.cpp, ollama.ai (rare in news)
    r")\b"
)

# Words that are too generic / don't deserve a glossary entry even
# if they match the regex shape (single-letter caps, brand-only words
# already obvious to most readers). Updated as the curation evolves.
_BLOCKLIST: frozenset[str] = frozenset(
    {"AI", "API", "URL", "ID", "GPU", "CPU", "CEO", "CFO", "CTO",
     "USA", "EU", "UK", "US", "EN", "JA", "ES", "FIL"}
)


SEED_MODES = ("insert", "upsert")


def init_glossary_seed(
    conn: sqlite3.Connection,
    seed_yaml: Path,
    *,
    mode: str = "insert",
) -> dict[str, int]:
    """Idempotently load the seed YAML into glossary_terms.

    Modes:
      "insert" (default) — insert rows whose term doesn't yet exist;
        existing rows are never touched. Safe for the daily flow.
      "upsert" — also UPDATE definition fields on existing rows from
        the YAML (aliases, eli14/why locale fan-out, canonical_link,
        status, reviewed_by_human). DB-owned fields are preserved:
        first_seen_date, last_seen_date, occurrences_30d,
        distinct_days_14d. updated_at is bumped on UPDATE.

    Returns {"inserted": N, "updated": M}. M is always 0 in insert mode.
    """
    if mode not in SEED_MODES:
        raise ValueError(f"unknown seed mode: {mode!r}; expected one of {SEED_MODES}")
    if not seed_yaml.is_file():
        return {"inserted": 0, "updated": 0}
    try:
        import yaml  # type: ignore
    except ImportError:
        # Fallback: a tiny ad-hoc parser for the seed shape only.
        # Upsert is not supported without PyYAML — too little info to update.
        return {"inserted": _seed_without_yaml(conn, seed_yaml), "updated": 0}
    data = yaml.safe_load(seed_yaml.read_text(encoding="utf-8")) or {}
    inserted = 0
    updated = 0
    today = _today()
    for entry in data.get("terms", []):
        cur = conn.execute(
            "SELECT 1 FROM glossary_terms WHERE term = ?", (entry["term"],)
        )
        if cur.fetchone():
            if mode == "upsert":
                conn.execute(
                    """
                    UPDATE glossary_terms SET
                      aliases_json        = ?,
                      one_liner_eli14     = ?,
                      one_liner_eli14_ja  = ?,
                      one_liner_eli14_es  = ?,
                      one_liner_eli14_fil = ?,
                      why_it_matters      = ?,
                      why_it_matters_ja   = ?,
                      why_it_matters_es   = ?,
                      why_it_matters_fil  = ?,
                      canonical_link      = ?,
                      status              = ?,
                      reviewed_by_human   = ?,
                      updated_at          = ?
                    WHERE term = ?
                    """,
                    (
                        json.dumps(entry.get("aliases") or []),
                        entry.get("one_liner_eli14"),
                        entry.get("one_liner_eli14_ja"),
                        entry.get("one_liner_eli14_es"),
                        entry.get("one_liner_eli14_fil"),
                        entry.get("why_it_matters"),
                        entry.get("why_it_matters_ja"),
                        entry.get("why_it_matters_es"),
                        entry.get("why_it_matters_fil"),
                        entry.get("canonical_link"),
                        entry.get("status", "active"),
                        1 if entry.get("reviewed_by_human") else 0,
                        today,
                        entry["term"],
                    ),
                )
                updated += 1
            continue
        conn.execute(
            """
            INSERT INTO glossary_terms (
                term, aliases_json,
                one_liner_eli14, one_liner_eli14_ja,
                one_liner_eli14_es, one_liner_eli14_fil,
                why_it_matters, why_it_matters_ja,
                why_it_matters_es, why_it_matters_fil,
                canonical_link, status, first_seen_date,
                occurrences_30d, distinct_days_14d, reviewed_by_human
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
            """,
            (
                entry["term"],
                json.dumps(entry.get("aliases") or []),
                entry.get("one_liner_eli14"),
                entry.get("one_liner_eli14_ja"),
                entry.get("one_liner_eli14_es"),
                entry.get("one_liner_eli14_fil"),
                entry.get("why_it_matters"),
                entry.get("why_it_matters_ja"),
                entry.get("why_it_matters_es"),
                entry.get("why_it_matters_fil"),
                entry.get("canonical_link"),
                entry.get("status", "candidate"),
                today,
                1 if entry.get("reviewed_by_human") else 0,
            ),
        )
        inserted += 1
    conn.commit()
    return {"inserted": inserted, "updated": updated}


def _seed_without_yaml(conn: sqlite3.Connection, seed_yaml: Path) -> int:
    """Bootstrap when PyYAML isn't available — just scan for `- term:` lines.

    Pulls only the term and status; leaves definitions blank so the LLM
    fill pass can populate them later. Used in CI / sandbox runs that
    don't ship PyYAML.
    """
    text = seed_yaml.read_text(encoding="utf-8")
    inserted = 0
    today = _today()
    for m in re.finditer(r"^\s*-\s+term:\s*(.+?)\s*$", text, re.MULTILINE):
        term = m.group(1).strip()
        cur = conn.execute("SELECT 1 FROM glossary_terms WHERE term = ?", (term,))
        if cur.fetchone():
            continue
        conn.execute(
            """
            INSERT INTO glossary_terms (
                term, aliases_json, status, first_seen_date,
                occurrences_30d, distinct_days_14d, reviewed_by_human
            ) VALUES (?, '[]', 'active', ?, 0, 0, 1)
            """,
            (term, today),
        )
        inserted += 1
    conn.commit()
    return inserted


def extract_candidates(news_text: str) -> dict[str, int]:
    """Return a {term: hit_count} dict for all candidate-shaped tokens."""
    counts: dict[str, int] = {}
    for m in _TOKEN_RE.finditer(news_text):
        tok = m.group(1)
        if tok in _BLOCKLIST:
            continue
        if tok.casefold() in _STOPWORDS:
            continue
        # Drop tokens that are pure year/number after stripping decoration.
        if re.fullmatch(r"\d+", tok.replace("-", "").replace(".", "")):
            continue
        counts[tok] = counts.get(tok, 0) + 1
    return counts


def upsert_occurrence(
    conn: sqlite3.Connection,
    term: str,
    occurrence_date: str,
    hit_count: int,
    source: str,
) -> None:
    conn.execute(
        """
        INSERT INTO glossary_occurrences (term, occurrence_date, hit_count, source)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (term, occurrence_date) DO UPDATE SET
          hit_count = hit_count + excluded.hit_count
        """,
        (term, occurrence_date, hit_count, source),
    )


def add_candidate_if_new(
    conn: sqlite3.Connection, term: str, today: str
) -> bool:
    """Insert a `candidate` row if `term` isn't yet in the table.

    Returns True if a new row was inserted.
    """
    cur = conn.execute("SELECT 1 FROM glossary_terms WHERE term = ?", (term,))
    if cur.fetchone():
        return False
    conn.execute(
        """
        INSERT INTO glossary_terms (
            term, aliases_json, status, first_seen_date,
            occurrences_30d, distinct_days_14d, reviewed_by_human
        ) VALUES (?, '[]', 'candidate', ?, 0, 0, 0)
        """,
        (term, today),
    )
    return True


def recompute_rolling(conn: sqlite3.Connection, term: str, today: str) -> None:
    cur = conn.execute(
        """
        SELECT
          COALESCE(SUM(hit_count), 0) AS hits_30d,
          COUNT(DISTINCT occurrence_date) AS days_14d
        FROM glossary_occurrences
        WHERE term = ?
          AND occurrence_date >= date(?, '-30 days')
        """,
        (term, today),
    )
    row = cur.fetchone()
    hits_30d = row[0] if row else 0
    cur = conn.execute(
        """
        SELECT COUNT(DISTINCT occurrence_date)
        FROM glossary_occurrences
        WHERE term = ?
          AND occurrence_date >= date(?, '-14 days')
        """,
        (term, today),
    )
    days_14d = cur.fetchone()[0] or 0
    conn.execute(
        """
        UPDATE glossary_terms
           SET occurrences_30d   = ?,
               distinct_days_14d = ?,
               last_seen_date    = ?
         WHERE term = ?
        """,
        (hits_30d, days_14d, today, term),
    )


def run(
    news_file: Path,
    db_path: Path,
    seed_yaml: Path | None,
    seed_mode: str = "insert",
) -> dict:
    if not news_file.is_file():
        raise FileNotFoundError(f"news file not found: {news_file}")
    if not db_path.is_file():
        raise FileNotFoundError(f"DB not found: {db_path}; run app/update_pages.bat first")

    today = _date_from_news_filename(news_file.name) or _today()
    text = news_file.read_text(encoding="utf-8")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    seed_counts = {"inserted": 0, "updated": 0}
    if seed_yaml is not None:
        seed_counts = init_glossary_seed(conn, seed_yaml, mode=seed_mode)
    counts = extract_candidates(text)
    new_candidates = 0
    bumped = 0
    for term, hits in counts.items():
        if add_candidate_if_new(conn, term, today):
            new_candidates += 1
        upsert_occurrence(conn, term, today, hits, "news")
        bumped += 1
    conn.commit()
    for term in counts:
        recompute_rolling(conn, term, today)
    conn.commit()
    conn.close()
    return {
        "news_file": str(news_file),
        "today": today,
        "seeded": seed_counts["inserted"],
        "seeded_updated": seed_counts["updated"],
        "seed_mode": seed_mode if seed_yaml is not None else None,
        "new_candidates": new_candidates,
        "occurrences_bumped": bumped,
        "tokens_seen": len(counts),
    }


def _today() -> str:
    import datetime as _dt
    return _dt.date.today().isoformat()


def _date_from_news_filename(name: str) -> str | None:
    m = re.search(r"(\d{4})(\d{2})(\d{2})", name)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Extract glossary candidates from a news file")
    p.add_argument("--news-file", required=True, type=Path)
    p.add_argument("--db", required=True, type=Path)
    p.add_argument("--seed-yaml", type=Path, default=None,
                   help="Day-0 seed YAML (idempotent; safe to pass on every run)")
    p.add_argument("--seed-mode", choices=list(SEED_MODES), default="insert",
                   help="insert (default): only add new terms from YAML. "
                        "upsert: also UPDATE definition fields on existing rows "
                        "from YAML. DB-managed counters/dates are preserved.")
    args = p.parse_args(argv)
    try:
        summary = run(args.news_file, args.db, args.seed_yaml, args.seed_mode)
    except FileNotFoundError as e:
        print(f"FAIL {e}", file=sys.stderr)
        return 2
    except ValueError as e:
        print(f"FAIL {e}", file=sys.stderr)
        return 2
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
