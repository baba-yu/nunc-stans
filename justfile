set shell := ["bash", "-uc"]
set windows-shell := ["sh", "-cu"]

# The data store is user-designated (workspace model): `just bootstrap [dir]`
# initializes a folder of your choice and remembers it in the app config;
# tools/data-dir.ts resolves it (NS_DATA env overrides per invocation).
# No data path is hardcoded in this repo (FD-3.2).

data_dir := `node tools/data-dir.ts 2>/dev/null || true`

# Doctor + data-store designation/init (idempotent). `just bootstrap <dir>`
# designates a folder; without an argument it reuses the configured store
# or asks interactively.
bootstrap dir='':
    sh tools/bootstrap.sh "{{dir}}"

_require_data:
    @if [ -z "{{data_dir}}" ]; then echo "no data store configured - run: just bootstrap <dir>  (or set NS_DATA)"; exit 1; fi

# --- News pipeline (nunc-fluens, Phase C) -----------------------------
# The news data+publish checkout is user-designated like the data store:
# `just news-link <dir>` remembers it (config news_repo; NS_NEWS_REPO
# overrides per invocation).

news-link dir:
    node engines/nunc-fluens/pipeline/src/cli.ts link "{{dir}}"

news-status:
    node engines/nunc-fluens/pipeline/src/cli.ts status

# Copy analytics.sqlite into <data store>/world/ (verified, idempotent;
# junk siblings are not migrated; upstream copy stays until cutover).
news-migrate-db: _require_data
    node engines/nunc-fluens/pipeline/src/cli.ts migrate-db

# Schema-validate one day's sourcedata (incl. locale fan-out).
news-validate date:
    node engines/nunc-fluens/pipeline/src/cli.ts validate "{{date}}"

# One origin (the gate, :8720) fronts everything; the ledger engine (:8721)
# and the fourfive server (:8787) stay loopback-internal behind it.
# NS_PORT moves the gate; NS_ENGINE_PORT moves the engine. The three
# commands live in sub-recipes so quoting and env expansion happen in
# just's shell on every OS (concurrently itself never parses them).
up: _require_data build
    pnpm exec concurrently -k -n engine,fourfive,gate -c yellow,blue,cyan \
      "just _up-engine" "just _up-fourfive" "just _up-gate"

_up-engine: _require_data
    cargo run --manifest-path engines/nunc-stans/Cargo.toml --release -- \
      --self-dir "{{data_dir}}/self" \
      --port "${NS_ENGINE_PORT:-8721}"

_up-fourfive:
    pnpm -C engines/fourfive start:server

_up-gate:
    cargo run --manifest-path gate/Cargo.toml --release -- \
      --port "${NS_PORT:-8720}" \
      --engine-url "http://127.0.0.1:${NS_ENGINE_PORT:-8721}" \
      --fourfive-url "http://127.0.0.1:8787" \
      --formans-dist frontend/nunc-stans-formans/dist \
      --fourfive-dist engines/fourfive/dist \
      --data-dir "{{data_dir}}"

# Build everything the gate serves. The world adapter runs first so the
# read-only world view has fresh headlines. NEWS_WORLD points at News's
# exported graph (e.g. ~/news/docs/data/graph-mix.json); its path lives
# outside this repo, like the data store. Unset = empty world view.
build: build-world
    pnpm install --frozen-lockfile || pnpm install
    pnpm -r build
    cargo build --release --manifest-path engines/nunc-stans/Cargo.toml
    cargo build --release --manifest-path gate/Cargo.toml

# Flatten News's world export into the formans public dir AND stage the News
# dashboard (as-is, d3 vendored — no CDN) for the /world-graph/ wrap
# (§13-B: conversion on the Nunc Stans side; News is not asked to change).
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
