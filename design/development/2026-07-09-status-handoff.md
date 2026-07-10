# Status & plan — 2026-07-09 (single source of truth, v2 — post-merge)

The one document to read when resuming. v1 (morning) planned two lanes and a
bug hunt; by evening the bug lane is DONE and both lanes are MERGED to dev
(`9aa7e5d`, pushed). Facts below are verified against git, the suites, and
live runs — not memory.

---

## 0. THE PLAN FROM HERE (do these in order)

1. **Phase E T9** — build `runway-tracker@v1` through the real FourFive chat
   flow → freeze → bundle → live CRUD via the generated UI; add the
   `/strategy` stage-3 card. The 27B is live with working tool_calls, so
   nothing blocks this.
2. **Phase E T10** — execute stories **S-7** and **S-8**.
   NOTE for the scratch-store setup lines (`export NS_DATA=$(mktemp -d)`):
   this is now SAFE — bootstrap/setup no longer persist an NS_DATA override
   into the real config (the 2026-07-09 bug). Run them freely.
3. **Phase E T11–T12** — S-10 re-run incl. `/apps/`, 3-OS CI, screenshots
   → `design/ui/phase-e/`, then close (verification exit checklist,
   `contracts/app-bundle.md` owner review, dev→main gate).
4. **Topics T7** — the authoring story (author in NL → structure via the
   live llama → merge-review → save → a run honors the intent weights);
   evidence in `design/verification/topics-authoring.md`. Needs a linked
   writable instance (`just news-init` + `just news-link`).

One lane at a time; branch off `origin/dev`, PR back to dev (or merge
locally + push, as the owner prefers).

## 1. What happened 2026-07-09 (the bug lane, now CLOSED)

The owner's reported bugs — "FourFive stuck on mock, profile won't take
effect" — root-caused to TWO infrastructure defects, both fixed, merged
(`ee13e3b` fix-store-config, then `9aa7e5d` topics-authoring-ui):

- **Store misdirection:** a story runbook's `export NS_DATA=$(mktemp -d)`
  had been persisted by bootstrap into `~/.config/nunc-stans/config.json`,
  so the LIVE store (self vault, chat DB, 18GB models) sat in `/tmp` with an
  empty `profiles/` → no `fourfive-chat` default → mock. The store now
  lives at **`~/.local/share/nunc-stans/data`** (moved intact); bootstrap
  persists only an explicit `just bootstrap <dir>`, never env overrides
  (same guard added for `manda_data_dir` in setup).
- **Broken llama build:** the first `just setup` had installed the OpenVINO
  release asset, which hard-links libggml-openvino and crashes on hybrid
  DeltaNet models — Qwen3.6-27B aborts in ggml_backend_sched_split_graph
  (llama.cpp #22333, closed not-planned upstream; flags cannot avoid it).
  setup now detects accelerator builds, quarantines them to
  `llama.cpp-disabled/`, installs the plain CPU asset (b9945 verified), and
  **fails loudly** when a model cannot serve (the broken 27B had passed as
  "setup DONE" via a scrolled-away WARN).

Also landed (topics plan T4, was skipped): **`just up` now runs
`llama-server` itself** as a crash-inert 5th leg (`_up-llama`; standalone
`just llama`; `just down` clears :8080 only when the PID really is
llama-server). Model resolution: `NS_LLAMA_MODEL` > config `llama_model` >
the fourfive-chat profile's `model` > newest GGUF in `<store>/models`
(tools/llama.ts). `NS_SKIP_LLAMA=1` skips the leg.

**Live proof on merged dev:** health `llama-cpp / Qwen3.6-27B-Q4_K_M /
local-llama`; a real FourFive chat answered through the 27B; tool_calls
probe emits `get_time({"city":"Tokyo"})` (PE9' target confirmed on the 27B).

**Model backend (final, 2026-07-10):** the box has an RTX 5090. The stack's
own llama-server is now a **CUDA source build** (`llama.cpp-src/` b9946 tag,
nvcc 12.9 → `llama.cpp/llama-b9946-cuda-local/`; tools/llama.ts picks it as
the newest build): **27B ~70 tok/s gen, FourFive turn 3.3s through the
gate; tool_calls OK.** No ollama dependency — `llama_url` is cleared;
the ollama service is redundant now (owner runs
`sudo systemctl disable --now ollama` for the permanent stop; Restart=always
means a plain kill just resurrects it). The `llama_url` mechanism remains
for external OpenAI-compatible backends (NS_LLAMA_URL override; setup
auto-detects NVIDIA+ollama only when the key is absent). WSL notes: no
ubuntu cuda prebuilt exists (vulkan-via-Dozen measured 0.7 tok/s, slower
than CPU 2.6 — setup never picks it on WSL); the CPU prebuilt stays
installed as the fallback; upgrading the CUDA server later = rebuild from
a newer tag in `llama.cpp-src/`. Profiles: `local-llama` (model
`Qwen3.6-27B-Q4_K_M` — default) + `local-llama-3b`. Cleanup candidates:
quarantined builds in `~/.local/share/nunc-stans/llama.cpp-disabled/`,
leftover release tarballs in `llama.cpp/`, ~10 stale `/tmp/tmp.*` scratch
stores, config.json.bak.*.

## 2. Branch / merge state (verified)

| ref | commit | meaning |
|---|---|---|
| `dev` = `origin/dev` | `9aa7e5d` | everything above + Topics **T5/T6** (gate topics API + World TopicEditor) |
| work branches | — | none; fix-store-config / topics-authoring / topics-authoring-ui merged & deleted |

Suites on merged dev: `just check` green; `just test` green (engine 11+6,
gate 18 incl. topics API, formans 5 files incl. topics tests, fourfive 6,
apps-host 3, ai 7, agent 4, pipeline 214). The pipeline suite can flake
5s-timeouts under heavy disk load (e.g. right after a 17GB model load) —
rerun before believing a red.

## 3. Phase E standing state

- T0–T8 on dev (PR #5), T4-llama landed 2026-07-09; **exit checklist in
  `design/verification/phase-e.md` still all-unchecked — phase closes at
  T12**, nothing hidden.
- Owner gates unchanged: `contracts/agent-abi.md` + `contracts/app-bundle.md`
  reviews, S-10 re-run, 3-OS CI, screenshots, workspace `mv` (PE5), manda
  v0.2.0 tag.

## 4. Conventions a fresh context MUST know

- Branch off `origin/dev`; push with `git push -u origin <name>`; never
  `HEAD:dev`. (2026-07-09: owner had Claude merge locally + push dev
  directly — that was an explicit one-off instruction.)
- One commit = one area (`node tools/commit-scope.ts`); `design/` and
  `justfile` exempt. `just check` green before push.
- Gate never derives nf layout — flags only (`--news-repo`,
  `--instances-dir`), resolved in the justfile.
- Fork rule (hard): dev repo never writes production `~/news`; topics PUT
  refuses non-instances (409).
- Run env: WSL. PowerShell mangles `$`/quotes/parens in `wsl.exe` args —
  write scripts to `/tmp` and `wsl.exe bash /tmp/x.sh`.
- git identity: repo-local `yukibaba3912@gmail.com`. AI co-author trailer OK.
- The data store is CONFIG (`~/.config/nunc-stans/config.json`), not code:
  `data_dir` + `manda_data_dir` → `~/.local/share/nunc-stans/data`. Never
  point them at `/tmp`.

## 5. Run / try it

```sh
just up   # llama :8080 (27B on the GPU, CUDA build), engine :8721,
          # fourfive :8787, apps :8788, gate :8720
# http://127.0.0.1:8720 → FourFive badge: LLM: llama-cpp · local-llama (~3s turns)
just llama                # run only the model backend
NS_SKIP_LLAMA=1 just up   # skip the model leg (fast UI iterations)
# config llama_url (NS_LLAMA_URL) = optional external OpenAI-compat backend
```

- World topic UI (now on dev): needs an instance — `just news-init <name>`
  → `just news-link <name>` → World → "Research topics".
- Suites: `pnpm -C <pkg> test`; `cargo test --manifest-path gate/Cargo.toml`.
