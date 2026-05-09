"""Citation restriction check (shared by tasks 1 and 2).

Spec: ``design/skills/citation-restriction-check.md``.

Pure Python — no LLM. Reads the draft + policy file and surfaces any
host that the project policy disallows. Exits 1 on a denylist hit so
the orchestrator stops before fanning out into locale translations.

Three buckets close any citation:

  * ``denylist`` — explicit ToS-confirmed prohibition.
  * ``parent_groups`` — parent-corp ToS prohibition that auto-propagates
    to every owned subdomain. A host whose registrable suffix matches
    any host listed under a parent_groups entry inherits denylist.
  * ``unconfirmed_denylist`` — ToS could not be retrieved at survey time
    (404 / 403 / blocked / timed out / unreachable). Project policy: when
    a host's ToS is unconfirmed, default to denylist (safe-side).

Plus the historical ``paywall_short_quote_only`` (paraphrase ok, no
verbatim quote >25 words) and the informational ``requires_attribution``.

The skill also persists every UNCLASSIFIED host sighting to a ledger
file via ``--unclassified-out``. The ledger is markdown with a single
table sorted by total citation count desc; each daily run upserts new
sightings (count incremented, last_seen bumped, first_seen preserved).
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


_URL_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")


_HOST_BUCKETS = (
    "denylist",
    "paywall_short_quote_only",
    "unconfirmed_denylist",
    "requires_attribution",
)


def _parse_policy(policy_path: Path) -> dict[str, object]:
    out: dict[str, object] = {b: set() for b in _HOST_BUCKETS}
    out["parent_groups"] = []
    if not policy_path.is_file():
        return out
    text = policy_path.read_text(encoding="utf-8")
    current: str | None = None
    pg_current: dict | None = None
    for raw in text.splitlines():
        s = raw.strip()
        if s.startswith("## "):
            name = s[3:].strip()
            current = name if name in _HOST_BUCKETS or name == "parent_groups" else None
            pg_current = None
            continue
        if not current:
            continue
        if current == "parent_groups" and s.startswith("### "):
            parent_name = s[4:].strip()
            pg_current = {"parent": parent_name, "members": set()}
            out["parent_groups"].append(pg_current)
            continue
        if not s or s.startswith("#"):
            continue
        if current in _HOST_BUCKETS:
            if not (s.startswith("|") and s.endswith("|")):
                if current == "requires_attribution" and s.startswith("- "):
                    out[current].add(s[2:].strip().lower())
                continue
            cells = [c.strip() for c in s.strip("|").split("|")]
            if not cells:
                continue
            first = cells[0].lower()
            if not first or set(first) <= set("- :") or first in ("host", "site"):
                continue
            out[current].add(first)
        elif current == "parent_groups" and pg_current is not None:
            if s.startswith("- "):
                pg_current["members"].add(s[2:].strip().lower())
    return out


def _matches_parent(host: str, parent_groups: list) -> str | None:
    """Return the parent name if host is a subdomain of any group's members.

    Suffix match on dot boundary so 'foo.cnbc.com' matches 'cnbc.com' but
    'notcnbc.com' does not.
    """
    for grp in parent_groups:
        for member in grp.get("members", set()):
            if host == member or host.endswith("." + member):
                return grp.get("parent", "")
    return None


def classify_host(host: str, policy: dict) -> str:
    if host in policy["denylist"]:
        return "denylist"
    if _matches_parent(host, policy["parent_groups"]) is not None:
        return "parent_inherited"
    if host in policy["unconfirmed_denylist"]:
        return "unconfirmed_denylist"
    if host in policy["paywall_short_quote_only"]:
        return "paywall_short_quote_only"
    if host in policy["requires_attribution"]:
        return "requires_attribution"
    return "unclassified"


_LEDGER_HEADER = """\
# Citation policy review queue

Auto-maintained by `app/skills/citation_restriction_check.py --unclassified-out`.
Each daily run upserts every UNCLASSIFIED host (no ToS-based classification yet) sighted in `report/<L>/news-*.md` and `future-prediction/<L>/future-prediction-*.md`. Counts include all sightings since the host first showed up; first_seen + last_seen are ISO dates (the dated draft file's date).

A human reviewer reads each entry's ToS, then either:
- promotes the host into `reference/citation-restrictions.md` (denylist / parent_groups / unconfirmed_denylist / paywall_short_quote_only / requires_attribution), or
- leaves it here under default-allow.

When a host is promoted, **delete its row from the table below** so this ledger stays a queue (not a denormalized cache).

Sorted by `count` descending, then host alphabetical.

| host | count | first_seen | last_seen | sample_label |
|---|---|---|---|---|
"""


def _parse_ledger(ledger_path: Path) -> dict[str, dict]:
    if not ledger_path.is_file():
        return {}
    rows: dict[str, dict] = {}
    in_table = False
    for raw in ledger_path.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if s.startswith("| host |"):
            in_table = True
            continue
        if in_table and s.startswith("|---"):
            continue
        if not in_table:
            continue
        if not (s.startswith("|") and s.endswith("|")):
            in_table = False
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if len(cells) < 5:
            continue
        host, count, first, last, label = cells[0], cells[1], cells[2], cells[3], cells[4]
        try:
            count_i = int(count)
        except ValueError:
            continue
        rows[host.lower()] = {
            "count": count_i,
            "first": first,
            "last": last,
            "label": label,
        }
    return rows


def _write_ledger(ledger_path: Path, rows: dict[str, dict]) -> None:
    sorted_rows = sorted(rows.items(), key=lambda kv: (-kv[1]["count"], kv[0]))
    body_lines = []
    for host, e in sorted_rows:
        label = (e.get("label") or "").replace("|", "\\|")
        body_lines.append(f"| {host} | {e['count']} | {e['first']} | {e['last']} | {label} |")
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    ledger_path.write_text(_LEDGER_HEADER + "\n".join(body_lines) + "\n", encoding="utf-8")


def _upsert_ledger(ledger_path: Path, new_sightings: dict[str, dict]) -> tuple[int, int]:
    existing = _parse_ledger(ledger_path)
    added = updated = 0
    for host, e in new_sightings.items():
        host = host.lower()
        if host in existing:
            cur = existing[host]
            cur["count"] += e["count"]
            if e["first"] < cur["first"] or not cur["first"]:
                cur["first"] = e["first"]
            if e["last"] > cur["last"] or not cur["last"]:
                cur["last"] = e["last"]
            if e["label"] and not cur.get("label"):
                cur["label"] = e["label"]
            updated += 1
        else:
            existing[host] = dict(e)
            added += 1
    _write_ledger(ledger_path, existing)
    return added, updated


def _draft_date(draft_path: Path) -> str:
    m = re.search(r"-(\d{4})(\d{2})(\d{2})\.md$", draft_path.name)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return dt.date.today().isoformat()


def check(draft_path: Path, policy_path: Path, *, unclassified_out: Path | None = None) -> int:
    if not draft_path.is_file():
        print(f"FAIL draft not found: {draft_path}", file=sys.stderr)
        return 2
    if not policy_path.is_file():
        print(f"TODO: {policy_path} missing — restriction check skipped")
        return 0
    policy = _parse_policy(policy_path)
    text = draft_path.read_text(encoding="utf-8")
    hits: dict[str, list] = {
        "RESTRICT": [], "RESTRICT_PARENT": [], "RESTRICT_UNCONFIRMED": [],
        "CAUTION_PAYWALL": [], "ATTRIBUTION_NOTE": [],
    }
    sightings: dict[str, dict] = {}
    draft_date = _draft_date(draft_path)
    for m in _URL_RE.finditer(text):
        url = m.group(2).rstrip(").,;:")
        host = (urlparse(url).hostname or "").lower()
        host = re.sub(r"^www\.", "", host)
        if not host:
            continue
        verdict = classify_host(host, policy)
        if verdict == "denylist":
            hits["RESTRICT"].append((host, url, m.group(1), ""))
        elif verdict == "parent_inherited":
            parent = _matches_parent(host, policy["parent_groups"]) or "?"
            hits["RESTRICT_PARENT"].append((host, url, m.group(1), parent))
        elif verdict == "unconfirmed_denylist":
            hits["RESTRICT_UNCONFIRMED"].append((host, url, m.group(1), ""))
        elif verdict == "paywall_short_quote_only":
            hits["CAUTION_PAYWALL"].append((host, url, m.group(1), ""))
        elif verdict == "requires_attribution":
            hits["ATTRIBUTION_NOTE"].append((host, url, m.group(1), ""))
        else:
            e = sightings.setdefault(host, {"count": 0, "first": draft_date, "last": draft_date, "label": ""})
            e["count"] += 1
            if draft_date < e["first"]:
                e["first"] = draft_date
            if draft_date > e["last"]:
                e["last"] = draft_date
            if not e["label"]:
                e["label"] = m.group(1)[:60]

    fail = False
    if hits["RESTRICT"]:
        fail = True
        print("FAIL reference restriction (denylist):")
        for host, url, label, _ in hits["RESTRICT"]:
            print(f"  RESTRICT {host}  ({label})  {url}")
    if hits["RESTRICT_PARENT"]:
        fail = True
        print("FAIL reference restriction (parent-inherited):")
        for host, url, label, parent in hits["RESTRICT_PARENT"]:
            print(f"  RESTRICT(parent={parent}) {host}  ({label})  {url}")
    if hits["RESTRICT_UNCONFIRMED"]:
        fail = True
        print("FAIL reference restriction (ToS unconfirmed -> safe-side):")
        for host, url, label, _ in hits["RESTRICT_UNCONFIRMED"]:
            print(f"  RESTRICT(unconfirmed) {host}  ({label})  {url}")
    if fail:
        print("Substitute each RESTRICT citation with an alternative source for the same factual claim, or drop the bullet. Re-run this check.")
    for host, url, label, _ in hits["CAUTION_PAYWALL"]:
        print(f"CAUTION (paywalled, paraphrase only): {host}  {url}")
    for host, url, label, _ in hits["ATTRIBUTION_NOTE"]:
        print(f"NOTE (attribution required, format already enforces): {host}")

    if sightings:
        unknown_hosts = sorted(sightings)
        print("UNCLASSIFIED hosts seen in this draft (review and decide if any belong on the lists):")
        for host in unknown_hosts:
            print(f"  - {host}")

    if unclassified_out is not None and sightings:
        added, upd = _upsert_ledger(unclassified_out, sightings)
        print(f"ledger {unclassified_out}: +{added} new, ~{upd} updated")

    if fail:
        return 1
    print(f"OK reference restriction: {draft_path}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Block denylisted citations in a draft markdown file")
    p.add_argument("--draft", required=True, type=Path)
    p.add_argument("--policy-file", default=Path("reference/citation-restrictions.md"), type=Path)
    p.add_argument("--unclassified-out", type=Path, default=None,
                   help="If set, upsert UNCLASSIFIED host sightings into this ledger markdown file.")
    args = p.parse_args(argv)
    return check(args.draft, args.policy_file, unclassified_out=args.unclassified_out)


if __name__ == "__main__":
    sys.exit(main())
