# FourFive × local LLM setup

FourFive abstracts the LLM provider (`server/llm/` → nunc-ai profiles). The
stack's **first-class local backend is its own llama-server** (`just setup`
installs it; the `_up-llama` leg of `just up` serves `<store>/models/*.gguf`
on :8080; knobs live in the Formans Profiles → "Model backend" panel).
**Read [Serving knobs & prompt discipline](#serving-knobs--prompt-discipline-llama-server)
before debugging "chat answers but no blueprint appears".** The Ollama path
below still works as a legacy/external backend (config `llama_url`).

---

## Prerequisites

- FourFive running inside WSL (WSL-native; see [../../README.md](../../README.md)).
- Ollama installed in WSL.
  - Check: `command -v ollama && ollama --version`
  - If missing (**needs sudo — run it yourself**):
    ```bash
    curl -fsSL https://ollama.com/install.sh | sh
    ```
- GPU (optional): NVIDIA is auto-used via CUDA (`nvidia-smi` to confirm). CPU works but is slow.

---

## Steps (5)

### 1. Start the Ollama daemon
```bash
bash scripts/ollama-bg.sh   # listens on :11434, auto-detects GPU, won't double-start, log: /tmp/ollama.log
```
(Plain command: `ollama serve &`.) The startup log shows GPU detection on success:
```
inference compute ... library=CUDA ... description="NVIDIA GeForce RTX 5090" total="31.8 GiB"
```

### 2. Pull a model
```bash
ollama pull qwen2.5:14b   # e.g. — qwen is strong at Japanese + structured JSON
ollama list               # confirm installed models and exact tags
```

### 3. Create a profile (Phase D — replaces `.env` provider config)
Model selection lives in **profiles** now. On the Formans **Profiles**
screen create e.g.:
```json
{ "id": "local-chat", "name": "Local chat", "provider": "llama-cpp",
  "model": "Qwen3.6-27B-Q4_K_M.gguf",
  "system_prompt": "You are FourFive's design partner. Help the user shape the app they want: confirm requirements, ask at most a few clarifying questions, and summarize decisions. Keep replies under 300 words. Never write implementation code or HTML — the system builds the app from the design automatically. Reply in the user's language." }
```
(provider `ollama` + the exact tag from `ollama list` for the legacy path.)
**Do not omit `system_prompt`** — see
[prompt discipline](#serving-knobs--prompt-discipline-llama-server): without
it, code-eager models dump a full implementation into chat and starve the
blueprint step. Set the profile as the **FourFive chat** default. Or through
the gate directly:
```bash
curl -X PUT :8720/api/profiles/local-chat -H 'content-type: application/json' \
  -d '{"id":"local-chat","name":"Local chat","provider":"llama-cpp","model":"Qwen3.6-27B-Q4_K_M.gguf","system_prompt":"You are FourFive'\''s design partner. Confirm requirements, ask at most a few clarifying questions, summarize decisions. Keep replies under 300 words. Never write implementation code or HTML — the system builds the app from the design automatically. Reply in the user'\''s language."}'
curl -X PUT :8720/api/profiles/defaults -H 'content-type: application/json' \
  -d '{"fourfive-chat":"local-chat"}'
```

### 4. No restart needed
The default profile is re-resolved **per message** — switching profiles
takes effect on the next message.

### 5. Verify
```bash
node scripts/llm-check.mjs   # prints health=ollama, a real reply, and whether a blueprint was generated
```
Chat at `http://localhost:5173`. The right pane updates **only when a blueprint is
successfully generated**.

---

## Switch models / back to mock

| action            | how                                                                       |
| ----------------- | ------------------------------------------------------------------------- |
| change model      | edit the profile's `model` on the Profiles screen — next message uses it |
| back to the offline demo | clear the FourFive chat default (or delete the profile)             |
| switch to Anthropic | a profile with `"provider": "anthropic-api"` + `ANTHROPIC_API_KEY` in the env (BYOL — never in the profile) |
| list installed    | `ollama list`                                                            |

---

## Daemon management

| action                            | command                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| start / check                     | `bash scripts/ollama-bg.sh` (no-op if already running)                 |
| liveness                          | `curl -s localhost:11434/api/tags`                                     |
| log                               | `/tmp/ollama.log`                                                      |
| stop                              | `pkill -f 'ollama serve'`                                              |
| restart (after a binary upgrade)  | `bash scripts/ollama-restart.sh`                                       |
| diagnose (hang)                   | `bash scripts/ollama-diag.sh`                                          |
| GPU usage                         | `nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv,noheader` |

> The daemon dies when WSL restarts; re-run `bash scripts/ollama-bg.sh` afterward
> (use systemd etc. for a persistent service).

---

## Behavior notes (measured)

FourFive calls the LLM **twice per message** — ① the human-readable chat reply
(streamed) ② `proposeBlueprint` (structured JSON). Latency ≈ model size × output tokens.

| observed (qwen2.5:7b / RTX 5090, q4)   | value |
| -------------------------------------- | ----- |
| latency (cold, incl. model load)       | ~59s  |
| latency (warm)                         | ~20s  |
| chat reply                             | good  |
| blueprint generation                   | unstable on small models (not always valid JSON) |

- **Bigger model = more reliable** blueprint JSON and language quality. VRAM (q4):
  7B≈5GB / 14B≈9GB / 32B-class≈20GB. An RTX 5090 (28GB usable) is comfortable up to 32B-class.
- Small models may drift the app name etc. into another language; larger models reduce this.
- The first message includes a VRAM load (slow); subsequent warm messages are fast (kept loaded for a few minutes).
- A failed blueprint never breaks chat (best-effort).
- **Streaming**: chat replies stream token-by-token over SSE. With a
  thinking-capable model and the **Thinking toggle** ON, the reasoning shows in a
  "💭 thinking" box that auto-collapses when the reply starts. Measured
  qwen3.6:27b: think **OFF ~59s / ON ~295s** (≈5×); OFF is usually enough for
  design extraction.

---

## Hardening (optional, not implemented)

Ollama can take a **JSON schema** as `format` (structured outputs). Deriving a JSON
schema from FourFive's zod schema (`server/blueprint-schema.ts`) and passing it to
`proposeBlueprint` (`server/llm/ollama.ts`) would make even small models almost
always schema-valid. Ask if you want it.

---

## Troubleshooting

| symptom                                          | fix                                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| can't reach :11434                               | daemon not running. `bash scripts/ollama-bg.sh`; check `/tmp/ollama.log`             |
| `health` still `mock`                            | restart to load `.env`. `bash scripts/dev-restart.sh`                                |
| no blueprint generated                           | model isn't returning valid JSON. Use a bigger model / structured output. Chat still works |
| GPU not used                                     | check `nvidia-smi`. New GPUs may need an Ollama update (`ollama -v`); otherwise falls back to CPU (slow) |
| model-name error                                 | confirm the exact tag with `ollama list`; pull if missing                           |
| `unknown runner engine` / new model spins forever | typically a **stale daemon after upgrading the ollama binary**. Check server/client version skew with `ollama -v` → `bash scripts/ollama-restart.sh`. Diagnose with `bash scripts/ollama-diag.sh` |

---

## Serving knobs & prompt discipline (llama-server)

Field notes from a live root-cause session (2026-07-10): FourFive "answers in
chat but never produces a Mock UI / ERD" is almost never the model's fault.
Three traps, in the order they bite:

### 1. Per-slot context = `llama_ctx / llama_parallel`

llama-server's `-c` (config `llama_ctx`) is the **total** KV budget, split
evenly across `--parallel` (config `llama_parallel`) static slots. One request
gets `llama_ctx / llama_parallel` tokens for prompt **and** output combined
(32768 / 4 = 8192 per slot). The blueprint call sends the whole conversation +
the current blueprint + the schema and generates a large JSON, so it is the
first thing to die: over-budget generations truncate (broken JSON → discarded),
oversized prompts get HTTP 400 `exceed_context_size_error`. Rule of thumb:
**give FourFive ≥16k per slot** (e.g. 65536/4). Knobs apply on backend restart
(the panel's Apply, or `POST /api/model-backend/restart`).

### 2. Where the prompts live — and which ones NOT to touch

| prompt | lives in | touch it? |
| --- | --- | --- |
| chat discipline (design-partner behavior) | the profile's `system_prompt` — `<store>/profiles/<id>.json`, editable on the Profiles screen | yes, this is the user-tunable one. **Without it, code-eager models (Qwen3.6 27B and 35B alike, measured) answer "make me an app" by dumping an entire single-file implementation (8–14k tokens), flooding the slot and killing the blueprint step** |
| blueprint extractor | `server/llm/blueprint-prompt.ts` | no — engine-internal, paired with the `shared/blueprint.ts` schema contract; change them together or not at all |
| offline demo | `server/llm/offline-demo.ts` | no — engine-internal |
| news pipeline steps | `engines/nunc-fluens/pipeline/prompts/` | no — engine-internal, golden-tested |

A proven `system_prompt` for local models: *"You are FourFive's design partner.
Confirm requirements, ask at most a few clarifying questions, summarize
decisions. Keep replies under 300 words. Never write implementation code or
HTML — the system builds the app from the design automatically. Reply in the
user's language."*

### 3. The thinking tax on `maxTokens`

Reasoning models (Qwen3.6 family) think **before** they answer, and the
reasoning tokens count against the per-message output cap first. A cap under
~8000 can produce an empty visible reply (the whole budget went to thinking)
and a truncated blueprint — the same cap is currently passed to both calls.
Leave the per-message cap **unset** unless you know the model's habits.

### Forensics

Every LLM call appends one line to `<store>/runs/ai-runs.jsonl` (caller,
model, input/output tokens, outcome). Two smoking guns:
`inputTokens + outputTokens == llama_ctx / llama_parallel` exactly ⇒ slot
truncation; `exceed_context_size_error` ⇒ the prompt alone no longer fits.
A failed blueprint never breaks chat (best-effort by design), so check the
run log before blaming the model.

---

## Related files

- `server/llm/nunc-ai.ts` — profile resolution + the nunc-ai glue (chat,
  stream, verify loop, blueprint step); providers live in
  `frontend/packages/ai`
- `server/llm/offline-demo.ts` — the canned no-model demo (invoice blueprint)
- `server/llm/blueprint-prompt.ts` — blueprint prompt + JSON extraction
- `scripts/ollama-bg.sh` / `ollama-restart.sh` / `ollama-diag.sh` / `dev-restart.sh` / `llm-check.mjs`
