set shell := ["bash", "-uc"]

# The data store is user-designated (workspace model): `just bootstrap [dir]`
# initializes a folder of your choice and remembers it in the app config;
# tools/data-dir.ts resolves it (NS_DATA env overrides per invocation).
# No data path is hardcoded in this repo (FD-3.2).

data_dir := `node tools/data-dir.ts 2>/dev/null || true`

# Doctor + data-store designation/init (idempotent). `just bootstrap <dir>`
# designates a folder; without an argument it reuses the configured store
# or asks interactively.
bootstrap dir='':
    sh tools/bootstrap.sh {{dir}}

_require_data:
    @if [ -z "{{data_dir}}" ]; then echo "no data store configured - run: just bootstrap <dir>  (or set NS_DATA)"; exit 1; fi

up: _require_data build-frontend
    cargo run --manifest-path engines/nunc-stans/Cargo.toml --release -- \
      --self-dir "{{data_dir}}/self" \
      --static-dir frontend/nunc-stans-formans/dist \
      --port "${NS_PORT:-8720}"

# Build the Vue frontend to frontend/nunc-stans-formans/dist. The world
# adapter runs first so the read-only world view has fresh headlines.
# NEWS_WORLD points at News's exported graph (e.g. ~/news/docs/data/graph-mix.json);
# its path lives outside this repo, like the data store. Unset = empty world view.
build-frontend: build-world
    pnpm install --frozen-lockfile || pnpm install
    pnpm -C frontend/nunc-stans-formans build

# Flatten News's world export into the formans public dir
# (§13-B: conversion on the Nunc Stans side; News is not asked to change).
build-world:
    node frontend/nunc-stans-formans/scripts/build-world.mjs

# Fast dev loop: Vite dev server (proxies /self + /health to the engine).
# Run `just build-world` once first if you want headlines in dev.
# Run `just up` (or the engine) in another terminal.
web:
    pnpm -C frontend/nunc-stans-formans dev

ritual: _require_data
    git -C "{{data_dir}}/self" add -A && \
    git -C "{{data_dir}}/self" commit -m "ritual: weekly review" || \
    echo "ritual: nothing to commit"

test:
    cargo test --manifest-path engines/nunc-stans/Cargo.toml
    pnpm -r test

check:
    @node tools/check.ts
