#!/bin/sh
# nunc-stans down: stop the stack started by `just up`.
# Terminates whatever is LISTENING on the gate, engine, and fourfive ports,
# honoring the same NS_PORT / NS_ENGINE_PORT overrides `just up` uses
# (fourfive is fixed at :8787). SIGTERM first, then SIGKILL any survivor.
# Idempotent: a no-op (exit 0) when nothing is running. Port-based on purpose
# so it also stops individually-started sub-recipes, not just a concurrently run.
set -u
say() { printf '%s\n' "$*"; }

GATE_PORT="${NS_PORT:-8720}"
ENGINE_PORT="${NS_ENGINE_PORT:-8721}"
FOURFIVE_PORT=8787

# Print the PIDs LISTENING on a TCP port, one per line (ss preferred, lsof fallback).
pids_on() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2
  elif command -v lsof >/dev/null 2>&1; then
    lsof -tnP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null
  fi
}

all_pids() {
  { pids_on "$GATE_PORT"; pids_on "$ENGINE_PORT"; pids_on "$FOURFIVE_PORT"; } | sort -u
}

signal_all() { # signal_all <SIGNAL> ; returns 0 if it signalled anything
  sig="$1"; sent=1
  for pid in $(all_pids); do
    [ -n "$pid" ] || continue
    if kill -"$sig" "$pid" 2>/dev/null; then say "down: SIG$sig -> pid $pid"; sent=0; fi
  done
  return "$sent"
}

if [ -z "$(all_pids)" ]; then
  say "down: nothing on ${GATE_PORT}/${ENGINE_PORT}/${FOURFIVE_PORT} - already down"
  exit 0
fi

signal_all TERM || true

# Wait up to ~5s for a graceful exit, then SIGKILL any survivor.
i=0
while [ "$i" -lt 10 ]; do
  [ -z "$(all_pids)" ] && break
  sleep 0.5
  i=$((i + 1))
done

if [ -n "$(all_pids)" ]; then
  say "down: survivors after SIGTERM - sending SIGKILL"
  signal_all KILL || true
  sleep 0.5
fi

if [ -z "$(all_pids)" ]; then
  say "down: stopped (${GATE_PORT}/${ENGINE_PORT}/${FOURFIVE_PORT} free)"
  exit 0
fi
say "down: WARNING - still bound: $(all_pids | tr '\n' ' ')"
exit 1
