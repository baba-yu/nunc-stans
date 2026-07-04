set shell := ["bash", "-uc"]

# FED_DATA must point at the data-store root, which lives OUTSIDE this
# repository (FD-3.2). Its actual path never appears in this repo; see
# design/development/setup-phase0.md.

up: build-frontend
    cargo run --manifest-path engines/nuncstans/Cargo.toml --release -- \
      --self-dir "${FED_DATA:?set FED_DATA to the data-store root}/self" \
      --static-dir frontend/dist \
      --port "${NS_PORT:-8720}"

# Build the Vue frontend to frontend/dist (served by the engine at /). The
# world adapter runs first so the read-only world view has fresh headlines.
# NEWS_WORLD points at News's exported graph (e.g. ~/news/docs/data/graph-mix.json);
# its path lives outside this repo, like FED_DATA. Unset = empty world view.
build-frontend: build-world
    pnpm -C frontend install --frozen-lockfile || pnpm -C frontend install
    pnpm -C frontend build

# Flatten News's world export into frontend/public/world-headlines.json
# (§13-B: conversion on the federation side; News is not asked to change).
build-world:
    node frontend/scripts/build-world.mjs

# Fast dev loop: Vite dev server (proxies /self + /health to the engine).
# Run `just build-world` once first if you want headlines in dev.
# Run `just up` (or the engine) in another terminal.
web:
    pnpm -C frontend dev

ritual:
    git -C "${FED_DATA:?set FED_DATA to the data-store root}/self" add -A && \
    git -C "${FED_DATA:?}/self" commit -m "ritual: weekly review" || \
    echo "ritual: nothing to commit"

test:
    cargo test --manifest-path engines/nuncstans/Cargo.toml
    pnpm -C frontend test

check:
    @bash tools/check.sh
