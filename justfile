set shell := ["bash", "-uc"]

# NS_DATA must point at the data-store root, which lives OUTSIDE this
# repository (FD-3.2). Its actual path never appears in this repo; see
# design/development/setup-phase0.md. FED_DATA is the deprecated old name
# and still works for one phase.

data_dir := env_var_or_default('NS_DATA', env_var_or_default('FED_DATA', ''))

_require_data:
    @if [ -z "{{data_dir}}" ]; then echo "set NS_DATA to the data-store root"; exit 1; fi
    @if [ -z "${NS_DATA:-}" ] && [ -n "${FED_DATA:-}" ]; then echo "warning: FED_DATA is deprecated; use NS_DATA"; fi

up: _require_data build-frontend
    cargo run --manifest-path engines/nunc-stans/Cargo.toml --release -- \
      --self-dir "{{data_dir}}/self" \
      --static-dir frontend/dist \
      --port "${NS_PORT:-8720}"

# Build the Vue frontend to frontend/dist (served by the engine at /). The
# world adapter runs first so the read-only world view has fresh headlines.
# NEWS_WORLD points at News's exported graph (e.g. ~/news/docs/data/graph-mix.json);
# its path lives outside this repo, like NS_DATA. Unset = empty world view.
build-frontend: build-world
    pnpm -C frontend install --frozen-lockfile || pnpm -C frontend install
    pnpm -C frontend build

# Flatten News's world export into frontend/public/world-headlines.json
# (§13-B: conversion on the Nunc Stans side; News is not asked to change).
build-world:
    node frontend/scripts/build-world.mjs

# Fast dev loop: Vite dev server (proxies /self + /health to the engine).
# Run `just build-world` once first if you want headlines in dev.
# Run `just up` (or the engine) in another terminal.
web:
    pnpm -C frontend dev

ritual: _require_data
    git -C "{{data_dir}}/self" add -A && \
    git -C "{{data_dir}}/self" commit -m "ritual: weekly review" || \
    echo "ritual: nothing to commit"

test:
    cargo test --manifest-path engines/nunc-stans/Cargo.toml
    pnpm -C frontend test

check:
    @bash tools/check.sh
