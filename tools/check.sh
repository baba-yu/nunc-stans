#!/usr/bin/env bash
set -uo pipefail
fail=0

# FD-3.2: whether the self data-store string has contaminated the tracked set
if git grep -nI "federation-data" -- . ':!tools/check.sh' ':!design/*' ':!**/prd-override.md' >/dev/null 2>&1; then
  echo "NG FD-3.2: 'federation-data' has leaked into code/config"; fail=1
else
  echo "ok FD-3.2: no vault path leak"
fi

# FD-7.4 (foundation): naive detection of engine-to-engine imports / references
# from frontend into engine internals. Federation:Phase 0 is a minimal
# string-based check; the full version uses per-language analysis.
if grep -rnE --exclude-dir={node_modules,dist,.git} "engines/(nunc-fluens|nunc-stans|fourfive)" frontend 2>/dev/null | grep -v "contracts/" >/dev/null; then
  echo "NG import: frontend references engine internals directly"; fail=1
else
  echo "ok import: frontend→contracts only (so far)"
fi

# whether the edge schema is valid JSON
if python3 -m json.tool contracts/edge.schema.json >/dev/null 2>&1; then
  echo "ok edge.schema.json valid"
else
  echo "NG edge.schema.json invalid"; fail=1
fi

exit $fail
