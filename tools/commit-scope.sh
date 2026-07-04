#!/usr/bin/env bash
set -uo pipefail
range="${1:-HEAD~1..HEAD}"
files=$(git diff --name-only $range)
areas=$(echo "$files" | grep -oE '^(engines/news|engines/nuncstans|engines/fourfive|frontend)' | sort -u)
n=$(echo "$areas" | grep -c . )
has_contracts=$(echo "$files" | grep -c '^contracts/')
if [ "$n" -gt 1 ] && [ "$has_contracts" -eq 0 ]; then
  echo "NG commit-scope: spans multiple areas (no contracts/)"; echo "$areas"; exit 1
fi
echo "ok commit-scope"
