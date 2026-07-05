#!/bin/sh
# nunc-stans bootstrap: doctor + NS_DATA skeleton. Idempotent.
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
command -v python3 >/dev/null 2>&1 || say "warn python3 missing (needed until Phase C retires the news pipeline)"
command -v ollama  >/dev/null 2>&1 || say "info ollama not found (optional - local models)"

say "== data store =="
NS_DATA="${NS_DATA:-${FED_DATA:-$HOME/nunc-stans-data}}"
say "NS_DATA=$NS_DATA"
for d in self world artifact profiles runs; do mkdir -p "$NS_DATA/$d"; done
if [ ! -d "$NS_DATA/self/.git" ]; then
  git -C "$NS_DATA/self" init -q && say "ok   initialized $NS_DATA/self as a git repo"
else
  say "ok   $NS_DATA/self is a git repo"
fi
if [ -n "$(git -C "$NS_DATA/self" remote 2>/dev/null)" ]; then
  say "NG   $NS_DATA/self has a git remote - forbidden (F11). Remove it."; missing=1
else
  say "ok   self vault has no remote (F11)"
fi
chmod 700 "$NS_DATA/self" 2>/dev/null || true

if [ "$missing" -eq 0 ]; then say "== bootstrap ok =="; else say "== bootstrap incomplete =="; fi
exit "$missing"
