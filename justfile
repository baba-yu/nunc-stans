set shell := ["bash", "-uc"]

# FED_DATA must point at the data-store root, which lives OUTSIDE this
# repository (FD-3.2). Its actual path never appears in this repo; see
# design/development/setup-phase0.md.

up:
    cargo run --manifest-path engines/nuncstans/Cargo.toml --release -- \
      --self-dir "${FED_DATA:?set FED_DATA to the data-store root}/self" \
      --static-dir frontend \
      --port "${NS_PORT:-8720}"

ritual:
    git -C "${FED_DATA:?set FED_DATA to the data-store root}/self" add -A && \
    git -C "${FED_DATA:?}/self" commit -m "ritual: weekly review" || \
    echo "ritual: nothing to commit"

test:
    cargo test --manifest-path engines/nuncstans/Cargo.toml

check:
    @bash tools/check.sh
