#!/bin/sh
# nunc-stans bootstrap: doctor + data-store designation.
# Usage: sh tools/bootstrap.sh [data-dir]
#   With an argument (or NS_DATA set): designates that folder, creates and
#   initializes it if needed, and remembers it in the app config.
#   Without: reuses the configured store, else the in-repo default
#   <repo>/data/ (gitignored; R13 2026-07-07).
# POSIX sh on purpose: this is the one script that runs before the toolchain
# exists (the documented exception to the TypeScript tooling policy).
set -u
missing=0
say() { printf '%s\n' "$*"; }
need() { # need <cmd> <hint>
  if command -v "$1" >/dev/null 2>&1; then say "ok   $1 ($(command -v "$1"))"
  else say "MISS $1 - install: $2"; missing=1; fi
}
say "== toolchain =="
need git   "https://git-scm.com"
need just  "cargo install just | apt install just | brew install just"
need node  "install Node >= 24 (https://nodejs.org), then: corepack enable"
need corepack "ships with Node; run: corepack enable"
need pnpm  "corepack enable (provides the pnpm shim)"
need cargo "https://rustup.rs (rust-toolchain.toml pins the version)"
if command -v node >/dev/null 2>&1; then
  major=$(node -e 'console.log(process.versions.node.split(".")[0])')
  if [ "$major" -lt 24 ]; then say "MISS node >= 24 (found $(node --version))"; missing=1; fi
fi
command -v ollama  >/dev/null 2>&1 || say "info ollama not found (optional - local models)"
# manda: the agent's memory gateway (Phase D). MANDA_BIN overrides PATH.
if [ -n "${MANDA_BIN:-}" ] && [ -x "${MANDA_BIN:-}" ]; then
  say "ok   manda (MANDA_BIN=$MANDA_BIN)"
elif command -v manda >/dev/null 2>&1; then
  say "ok   manda ($(command -v manda))"
else
  say "info manda not found (needed for nunc-stans-agent memory):"
  say "     run 'just setup' (installs manda + llama.cpp + a model), or build it:"
  say "     git clone https://github.com/baba-yu/manda ~/manda && (cd ~/manda && cargo build --release)"
fi

say "== data store =="
# The config must live where the app reads it (tools/data-dir.ts): %APPDATA%
# on native Windows (Git-Bash sh), XDG elsewhere. Paths written into the
# config must be Windows-form there — node cannot open /c/... MSYS paths.
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) WIN=1 ;;
  *) WIN=0 ;;
esac
if [ "$WIN" -eq 1 ] && [ -n "${APPDATA:-}" ]; then
  CFG_DIR="$(printf '%s' "$APPDATA" | tr '\\' '/')/nunc-stans"
else
  CFG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/nunc-stans"
fi
CFG="$CFG_DIR/config.json"
# NS_DATA is a per-invocation override (tools/lib/data-dir.ts), NOT a
# designation to remember. Only an explicit arg (or a genuine first run)
# is written to the persistent config; an NS_DATA-only run leaves it as-is.
# Regression guard: a story runbook's `export NS_DATA=$(mktemp -d)` once got
# baked into the real config, pointing the live store at a scratch /tmp dir.
ARG="${1:-}"
FROM_ENV=0
[ -z "$ARG" ] && [ -n "${NS_DATA:-}" ] && FROM_ENV=1
DIR="${ARG:-${NS_DATA:-}}"
if [ -z "$DIR" ] && [ -f "$CFG" ]; then
  # single-key file written by this script; keep the parse simple
  DIR=$(sed -n 's/.*"data_dir"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' "$CFG")
  [ -n "$DIR" ] && say "using the configured store: $DIR"
fi
if [ -z "$DIR" ]; then
  # The in-repo default (mirrors tools/lib/data-dir.ts defaultDataDir):
  # <repo>/data/, gitignored. An argument / NS_DATA / the config still
  # designate a store kept elsewhere.
  DIR="$(cd "$(dirname "$0")/.." && pwd)/data"
  say "using the in-repo default store: $DIR"
fi
mkdir -p "$DIR" || { say "NG   cannot create $DIR"; exit 1; }
if [ "$WIN" -eq 1 ]; then
  DIR=$(cd "$DIR" && pwd -W) # Windows form (C:/...) so node and cargo can open it
else
  DIR=$(cd "$DIR" && pwd)
fi
for d in self world artifact profiles runs; do mkdir -p "$DIR/$d"; done
if [ ! -d "$DIR/self/.git" ]; then
  git -C "$DIR/self" init -q && say "ok   initialized $DIR/self as a git repo"
else
  say "ok   $DIR/self is a git repo"
fi
if [ -n "$(git -C "$DIR/self" remote 2>/dev/null)" ]; then
  say "NG   $DIR/self has a git remote - forbidden (F11). Remove it."; missing=1
else
  say "ok   self vault has no remote (F11)"
fi
chmod 700 "$DIR/self" 2>/dev/null || true
if [ "$FROM_ENV" -eq 1 ]; then
  say "info NS_DATA override - using $DIR for this run only (config left as-is)"
else
  mkdir -p "$CFG_DIR"
  printf '{\n  "data_dir": "%s"\n}\n' "$DIR" > "$CFG"
  say "ok   data store remembered in $CFG"
fi

if [ "$missing" -eq 0 ]; then say "== bootstrap ok =="; else say "== bootstrap incomplete =="; fi
exit "$missing"
