#!/usr/bin/env bash
# End-to-end smoke test: starts the engine against a throwaway vault and
# walks the write paths, including the denials that keep the store honest.
set -u

BIN=${BIN:-target/debug/nunc-stans-engine}
PORT=${SMOKE_PORT:-8765}
BASE="http://127.0.0.1:$PORT"
VAULT=$(mktemp -d)
trap 'kill "$SERVER_PID" 2>/dev/null; rm -rf "$VAULT"' EXIT

git -C "$VAULT" init -q -b main
# Pin an identity so the throwaway vault commits even with no ambient git
# config (fresh clone / CI).
git -C "$VAULT" config user.name smoke
git -C "$VAULT" config user.email smoke@localhost
git -C "$VAULT" commit -q --allow-empty -m "self: vault init"

"$BIN" --self-dir "$VAULT" --port "$PORT" 2>/dev/null &
SERVER_PID=$!
for _ in $(seq 1 50); do
  curl -sf "$BASE/health" >/dev/null 2>&1 && break
  sleep 0.1
done

fail=0
check() {
  if grep -q "$2" <<<"$3"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; last_out=$3; fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

check "health" '"ok":true' "$(curl -s "$BASE/health")"

# author a commitment
out=$(curl -s -X POST "$BASE/self/commitments" -H 'content-type: application/json' \
  -d '{"slug":"smoke-a","title":"Smoke commitment","started_at":"2026-07-04","resources":{"money_jpy":1000,"hours":2}}')
check "commitment authored"        'self/commitment/smoke-a' "$out"
check "vault committed"            '"vault_committed":true'  "$out"

# append-only: same slug again must 409
check "duplicate slug refused" "409" "$(code -X POST "$BASE/self/commitments" -H 'content-type: application/json' \
  -d '{"slug":"smoke-a","title":"again","started_at":"2026-07-04"}')"

# a valid edge
out=$(curl -s -X POST "$BASE/self/edges" -H 'content-type: application/json' \
  -d '{"type":"serves","from":"self/commitment/smoke-a","to":"self/prediction/p2","to_label":"Standing prediction 2","author":"user"}')
check "edge appended"              '"type":"serves"' "$out"

# invalid edges must 422: bad id pattern, missing to_label, bogus author
check "bad scope id refused"  "422" "$(code -X POST "$BASE/self/edges" -H 'content-type: application/json' \
  -d '{"type":"serves","from":"news/item/x","to":"self/prediction/p2","to_label":"P2","author":"user"}')"
check "empty to_label refused"     "422" "$(code -X POST "$BASE/self/edges" -H 'content-type: application/json' \
  -d '{"type":"serves","from":"self/commitment/smoke-a","to":"self/prediction/p2","to_label":" ","author":"user"}')"
check "bogus author refused"       "422" "$(code -X POST "$BASE/self/edges" -H 'content-type: application/json' \
  -d '{"type":"serves","from":"self/commitment/smoke-a","to":"self/prediction/p2","to_label":"P2","author":"butler"}')"

check "edges listed"               'Standing prediction 2' "$(curl -s "$BASE/self/edges")"

# close: subjective vocabulary is closed, observable is open-shaped
check "subjective close recorded"  '"vault_committed":true' "$(curl -s -X POST "$BASE/self/outcomes" -H 'content-type: application/json' \
  -d '{"commitment_slug":"smoke-a","component":"subjective","result":"happy"}')"
check "bogus subjective refused"   "422" "$(code -X POST "$BASE/self/outcomes" -H 'content-type: application/json' \
  -d '{"commitment_slug":"smoke-a","component":"subjective","result":"satisfied"}')"
check "observable close recorded"  '"vault_committed":true' "$(curl -s -X POST "$BASE/self/outcomes" -H 'content-type: application/json' \
  -d '{"commitment_slug":"smoke-a","component":"observable","result":"partially_confirmed"}')"
check "unknown commitment refused" "404" "$(code -X POST "$BASE/self/outcomes" -H 'content-type: application/json' \
  -d '{"commitment_slug":"nope","component":"subjective","result":"happy"}')"

check "outcomes listed"            'partially_confirmed' "$(curl -s "$BASE/self/outcomes/smoke-a")"

# the network-facing security control: a non-local Host must be refused
check "rebinding host refused"     "403" "$(code -H 'Host: evil.example' "$BASE/health")"
check "localhost host allowed"     "200" "$(code -H 'Host: localhost' "$BASE/health")"

# over-long slug is a client mistake (422), never a 500
long=$(printf 'a%.0s' $(seq 1 300))
check "overlong slug refused 422"  "422" "$(code -X POST "$BASE/self/commitments" -H 'content-type: application/json' \
  -d "{\"slug\":\"$long\",\"title\":\"t\",\"started_at\":\"2026-07-04\"}")"

# the vault's git history is the audit record: every write left a commit
log=$(git -C "$VAULT" log --oneline)
check "audit: commitment in vault log" 'commitment_authored' "$log"
check "audit: edge in vault log"       'edge_appended'       "$log"
check "audit: close in vault log"      'commitment_close_recorded' "$log"

if [ "$fail" -ne 0 ]; then
  echo "--- last failing output ---"
  printf '%s\n' "${last_out:-}"
  echo "smoke: FAILURES"
else
  echo "smoke: all checks passed"
fi
exit "$fail"
