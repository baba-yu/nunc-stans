# FourFive × local LLM (Ollama) setup

FourFive abstracts the LLM provider (`server/llm/`); `.env` switches between `mock`
(default, offline), `ollama`, and `claude`. This guide covers connecting a local
LLM via **Ollama**.

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
{ "id": "local-chat", "name": "Local chat", "provider": "ollama",
  "model": "qwen2.5:14b" }
```
(match the exact tag from `ollama list`) and set it as the
**FourFive chat** default. Or through the gate directly:
```bash
curl -X PUT :8720/api/profiles/local-chat -H 'content-type: application/json' \
  -d '{"id":"local-chat","name":"Local chat","provider":"ollama","model":"qwen2.5:14b"}'
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

## Related files

- `server/llm/nunc-ai.ts` — profile resolution + the nunc-ai glue (chat,
  stream, verify loop, blueprint step); providers live in
  `frontend/packages/ai`
- `server/llm/offline-demo.ts` — the canned no-model demo (invoice blueprint)
- `server/llm/blueprint-prompt.ts` — blueprint prompt + JSON extraction
- `scripts/ollama-bg.sh` / `ollama-restart.sh` / `ollama-diag.sh` / `dev-restart.sh` / `llm-check.mjs`
