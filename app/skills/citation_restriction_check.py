"""Citation restriction check (shared by tasks 1 and 2).

Spec: ``design/skills/citation-restriction-check.md``.

Pure Python — no LLM. Reads the draft + policy file and surfaces any
host that the project policy disallows. Exits 1 on a denylist hit so
the orchestrator stops before fanning out into locale translations.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


_URL_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")


def _parse_policy(policy_path: Path) -> dict[str, set[str]]:
    """Parse the citation-restrictions.md policy file into 3 buckets."""
    if not policy_path.is_file():
        return {}
    text = policy_path.read_text(encoding="utf-8")
    buckets: dict[str, set[str]] = {
        "denylist": set(),
        "paywall_short_quote_only": set(),
        "requires_attribution": set(),
    }
    current: str | None = None
    for raw in text.splitlines():
        s = raw.strip()
        if s.startswith("## "):
            name = s[3:].strip()
            current = name if name in buckets else None
            continue
        if not current or not s or s.startswith("#"):
            continue
        if current in ("denylist", "paywall_short_quote_only"):
            if not (s.startswith("|") and s.endswith("|")):
                continue
            cells = [c.strip() for c in s.strip("|").split("|")]
            if not cells:
                continue
            first = cells[0].lower()
            if not first or set(first) <= set("- :") or first in ("host", "site"):
                continue
            buckets[current].add(first)
        elif current == "requires_attribution":
            if s.startswith("- "):
                buckets[current].add(s[2:].strip().lower())
    return buckets


def check(draft_path: Path, policy_path: Path) -> int:
    if not draft_path.is_file():
        print(f"FAIL draft not found: {draft_path}", file=sys.stderr)
        return 2
    if not policy_path.is_file():
        print(f"TODO: {policy_path} missing — restriction check skipped")
        return 0
    buckets = _parse_policy(policy_path)
    text = draft_path.read_text(encoding="utf-8")
    hits: dict[str, list[tuple[str, str, str]]] = {
        "RESTRICT": [],
        "CAUTION_PAYWALL": [],
        "ATTRIBUTION_NOTE": [],
    }
    all_hosts: set[str] = set()
    for m in _URL_RE.finditer(text):
        url = m.group(2).rstrip(").,;:")
        host = (urlparse(url).hostname or "").lower()
        host = re.sub(r"^www\.", "", host)
        if not host:
            continue
        all_hosts.add(host)
        if host in buckets["denylist"]:
            hits["RESTRICT"].append((host, url, m.group(1)))
        elif host in buckets["paywall_short_quote_only"]:
            hits["CAUTION_PAYWALL"].append((host, url, m.group(1)))
        elif host in buckets["requires_attribution"]:
            hits["ATTRIBUTION_NOTE"].append((host, url, m.group(1)))

    if hits["RESTRICT"]:
        print("FAIL reference restriction:")
        for host, url, label in hits["RESTRICT"]:
            print(f"  RESTRICT {host}  ({label})  {url}")
        print("Substitute each RESTRICT citation with an alternative source for "
              "the same factual claim, or drop the bullet. Re-run this check.")
        return 1

    for host, url, label in hits["CAUTION_PAYWALL"]:
        print(f"CAUTION (paywalled, paraphrase only): {host}  {url}")
    for host, url, label in hits["ATTRIBUTION_NOTE"]:
        print(f"NOTE (attribution required, format already enforces): {host}")
    known = (
        buckets["denylist"]
        | buckets["paywall_short_quote_only"]
        | buckets["requires_attribution"]
    )
    unknown = sorted(all_hosts - known)
    if unknown:
        print("UNCLASSIFIED hosts seen in this draft (review and decide if any belong on the lists):")
        for host in unknown:
            print(f"  - {host}")
    print(f"OK reference restriction: {draft_path}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Block denylisted citations in a draft markdown file")
    p.add_argument("--draft", required=True, type=Path)
    p.add_argument("--policy-file", default=Path("reference/citation-restrictions.md"), type=Path)
    args = p.parse_args(argv)
    return check(args.draft, args.policy_file)


if __name__ == "__main__":
    sys.exit(main())
