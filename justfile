set shell := ["bash", "-uc"]
set windows-shell := ["sh", "-cu"]

# The data store defaults to the in-repo <repo>/data/ (gitignored; R13
# 2026-07-07 — FD-3.2's no-data-in-git intent holds via the ignore).
# `just bootstrap [dir]` designates a folder kept elsewhere and remembers
# it in the app config; tools/data-dir.ts resolves the effective store
# (NS_DATA env overrides per invocation).

data_dir := `node tools/data-dir.ts 2>/dev/null || true`

# Doctor + data-store init (idempotent). `just bootstrap <dir>` designates
# a folder kept elsewhere; without an argument it reuses the configured
# store, else initializes the in-repo default <repo>/data/.
bootstrap dir='':
    sh tools/bootstrap.sh "{{dir}}"

# Batteries-included first run: bootstrap + manda + llama.cpp + a model
# (validated) + your first mandate (interactive). Re-runnable; each step
# no-ops when already satisfied. See agents/nunc-stans-agent/README.md.
setup *args:
    node tools/setup.ts {{args}}

# Safety net only: with the in-repo default the store always resolves;
# an empty value means tools/data-dir.ts itself failed to run.
_require_data:
    @if [ -z "{{data_dir}}" ]; then echo "no data store resolved - node tools/data-dir.ts failed? (set NS_DATA or just bootstrap <dir>)"; exit 1; fi

# --- News pipeline (nunc-fluens, Phase C; instance model V2/V3) -------
# The engine ships a TEMPLATE (pipeline/instance-template/); runs target
# DATA INSTANCES stamped from it by `just news-init` — one plain (git-less)
# data directory per profile, defaulting to gitignored
# engines/nunc-fluens/instances/<name>/.
# News-shaped checkouts are never run or viewed directly: their data
# comes over once via `just news-import` (the product's only news-shaped
# contact surface). The world view reads one instance, designated with
# `just news-link <instance>` (config news_repo; NS_NEWS_REPO overrides
# per invocation) — strictly read-only, data/exports/ only.

# Point the world view at an instance (read-only view source; path or
# bare name — bare names resolve under engines/nunc-fluens/instances/).
news-link dir:
    node engines/nunc-fluens/pipeline/src/cli.ts link "{{dir}}"

# Show resolved config (data store, linked instance, world-cache state).
news-status:
    node engines/nunc-fluens/pipeline/src/cli.ts status

# Schema-validate one day's sourcedata in the linked instance
# (incl. locale fan-out).
news-validate date:
    node engines/nunc-fluens/pipeline/src/cli.ts validate "{{date}}"

# Create a data instance from the engine template (skeleton + instance.json
# stamp + synthetic editorial seeds + schema-initialized store; no git).
# A bare name lands under engines/nunc-fluens/instances/<name>/ (gitignored).
news-init name_or_dir:
    node engines/nunc-fluens/pipeline/src/cli.ts init "{{name_or_dir}}"

# Copy a news-shaped checkout's data into a fresh init-born instance
# (recorded in its instance.json; the source is read-only, never touched).
news-import src instance:
    node engines/nunc-fluens/pipeline/src/cli.ts import "{{src}}" "{{instance}}"

# One pipeline run against an instance — path or bare name, resolved
# by the cli (see news-init / news-import).
news-daily instance:
    NS_INSTANCE="{{instance}}" node engines/nunc-fluens/pipeline/src/cli.ts run

# Distill the World's export-graph vocabulary into the instance glossary
# as candidate terms (topics-authoring W10) — the background feeder for
# offline authoring grounding. Idempotent; cron/systemd-friendly.
news-glossary instance:
    node engines/nunc-fluens/pipeline/src/cli.ts accumulate-glossary "{{instance}}"

# Install the daily systemd user units for an instance (Linux/WSL;
# path or bare name — install.sh resolves names like the cli does).
# Optional second arg = OnCalendar (default "*-*-* 06:30:00"); cron
# fallback is documented inside install.sh.
news-schedule instance oncalendar='*-*-* 06:30:00':
    sh engines/nunc-fluens/pipeline/systemd/install.sh "{{instance}}" "{{oncalendar}}"

# One origin (the gate, :8720) fronts everything; the ledger engine (:8721),
# the fourfive server (:8787), and apps-host (:8788, the generated-app host)
# stay loopback-internal behind it. NS_PORT moves the gate; NS_ENGINE_PORT
# moves the engine. The commands live in sub-recipes so quoting and env
# expansion happen in just's shell on every OS (concurrently itself never
# parses them).
up: _require_data build
    pnpm exec concurrently -k -n llama,engine,fourfive,apps,gate -c green,yellow,blue,magenta,cyan \
      "just _up-llama" "just _up-engine" "just _up-fourfive" "just _up-apps" "just _up-gate"

_up-engine: _require_data
    cargo run --manifest-path engines/nunc-stans/Cargo.toml --release -- \
      --self-dir "{{data_dir}}/self" \
      --port "${NS_ENGINE_PORT:-8721}"

_up-fourfive:
    pnpm -C engines/fourfive start:server

_up-apps: _require_data
    pnpm -C apps-host start:server

_up-gate:
    cargo run --manifest-path gate/Cargo.toml --release -- \
      --port "${NS_PORT:-8720}" \
      --engine-url "http://127.0.0.1:${NS_ENGINE_PORT:-8721}" \
      --fourfive-url "http://127.0.0.1:8787" \
      --apps-url "http://127.0.0.1:8788" \
      --formans-dist frontend/nunc-stans-formans/dist \
      --fourfive-dist engines/fourfive/dist \
      --data-dir "{{data_dir}}" \
      --instances-dir engines/nunc-fluens/instances

# Local model backend (T4 / plan 2026-07-08-topics-authoring exit #6):
# llama-server on :8080 (--jinja for tool-calls), the default provider for
# llama-cpp profiles. tools/llama.ts resolves the binary + the GGUF
# (NS_LLAMA_MODEL > config llama_model > the fourfive-chat profile's model >
# newest in <store>/models). No binary / no model / NS_SKIP_LLAMA=1 -> the leg
# stays inert so the rest of the stack still runs and the UI degrades honestly
# (W11 "local model offline"). NS_LLAMA_PORT / NS_LLAMA_CTX override.
_up-llama:
    #!/usr/bin/env bash
    set -uo pipefail
    if [ -n "${NS_SKIP_LLAMA:-}" ]; then echo "[llama] NS_SKIP_LLAMA set - local model backend skipped"; exec sleep infinity; fi
    bin=$(node tools/llama.ts bin || true)
    model=$(node tools/llama.ts model || true)
    if [ -z "$bin" ]; then echo "[llama] no llama-server binary - run 'just setup' (llama-cpp profiles show 'local model offline')"; exec sleep infinity; fi
    if [ -z "$model" ]; then echo "[llama] no GGUF in the store - run 'just setup' to install one"; exec sleep infinity; fi
    echo "[llama] serving $model on :${NS_LLAMA_PORT:-8080}"
    # Run (not exec): if llama-server crashes or the model is unloadable, the
    # leg must NOT exit, or `concurrently -k` would tear down the whole stack.
    # Stay inert instead so the UI degrades honestly (W11 "local model offline").
    "$bin" -m "$model" --host 127.0.0.1 --port "${NS_LLAMA_PORT:-8080}" --jinja -c "${NS_LLAMA_CTX:-8192}"
    echo "[llama] llama-server exited (code $?) - staying inert; the rest of the stack keeps running, llama-cpp profiles show 'local model offline'"
    exec sleep infinity

# Run only the local model backend in the foreground (same resolution as the
# _up-llama leg of `just up`) - (re)start the model without the whole stack.
llama:
    #!/usr/bin/env bash
    set -euo pipefail
    bin=$(node tools/llama.ts bin); model=$(node tools/llama.ts model)
    if [ -z "$bin" ] || [ -z "$model" ]; then echo "need llama-server + a GGUF - run 'just setup'"; exit 1; fi
    echo "[llama] serving $model on :${NS_LLAMA_PORT:-8080}"
    exec "$bin" -m "$model" --host 127.0.0.1 --port "${NS_LLAMA_PORT:-8080}" --jinja -c "${NS_LLAMA_CTX:-8192}"

# Stop the stack started by `just up`: terminates whatever is LISTENING on
# the gate/engine/fourfive/apps-host ports (honoring the same NS_PORT /
# NS_ENGINE_PORT overrides; fourfive fixed at :8787, apps-host at :8788).
# SIGTERM, then SIGKILL any survivor. Idempotent - a no-op if nothing is up.
# See tools/down.ts.
down:
    node tools/down.ts

# Stop the running stack (if any), then bring a fresh one up (rebuilds, like up).
restart:
    -node tools/down.ts
    just up

# Build everything the gate serves. The world adapter runs first so the
# read-only world view has fresh headlines. It reads the nunc-fluens
# instance designated via `just news-link <instance>` (config news_repo,
# NS_NEWS_REPO override) — strictly read-only, data/exports/ only (R6:
# no old-shape fallback). No instance linked = empty world view.
build: build-world
    pnpm install --frozen-lockfile || pnpm install
    pnpm -r build
    cargo build --release --manifest-path engines/nunc-stans/Cargo.toml
    cargo build --release --manifest-path gate/Cargo.toml

# Flatten the instance's world export into the formans public dir AND stage
# the ENGINE dashboard (engines/nunc-fluens/dashboard/, d3 vendored — no
# CDN) with the instance's data/exports/ for the /world-graph/ wrap
# (§13-B: conversion on the Nunc Stans side).
build-world:
    node tools/build-world.ts

# Fast dev loop: Vite dev server for formans (HMR). Run `just up` in
# another terminal — the dev proxy points at the gate (:8720).
web:
    pnpm -C frontend/nunc-stans-formans dev

ritual: _require_data
    git -C "{{data_dir}}/self" add -A && \
    git -C "{{data_dir}}/self" commit -m "ritual: weekly review" || \
    echo "ritual: nothing to commit"

test:
    cargo test --manifest-path engines/nunc-stans/Cargo.toml
    cargo test --manifest-path gate/Cargo.toml
    pnpm -r test

check:
    @node tools/check.ts

# The first-party terminal agent (Phase D): chat under the agents-default
# profile; memory through manda (MANDA_BIN / MANDA_DATA_DIR — see
# agents/nunc-stans-agent/README.md).
agent *args:
    node agents/nunc-stans-agent/src/cli.ts chat {{args}}
