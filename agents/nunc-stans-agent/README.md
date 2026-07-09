# nunc-stans-agent

The first-party terminal agent (v1 plan §2.11): chat with streaming and
visible thinking on any nunc-ai provider (Ollama first-class), with
memory **exclusively through the [manda](https://github.com/baba-yu/manda)
MCP gateway** — the agent proposes, the principal commits, mandates
authorize, everything is audited. No agent writes self-scope
commitments (F3), regardless of profile.

## Setup

**One command — `just setup`** — is the batteries-included path: it runs
bootstrap, builds/installs **manda** (the memory gateway), installs
**llama.cpp**'s `llama-server` (the default local model backend, PE9'),
downloads and validates a GGUF model, resolves the memory home, and grants
your first mandate interactively. Re-runnable; each step no-ops when
already satisfied.

You still pick **a profile** — create one on the Formans Profiles screen
(or via the gate), provider `llama-cpp` (default), and set it as the
**Agents** default; `--profile <id>` overrides per session. Without one,
an ad-hoc mock profile answers (offline).

<details><summary>Manual path (what <code>just setup</code> automates)</summary>

1. **manda** (runtime dependency, never vendored) — `MANDA_BIN`, or
   `manda` on PATH, or the local build `~/manda/target/release/manda`:

   ```sh
   git clone https://github.com/baba-yu/manda ~/manda && (cd ~/manda && cargo build --release)
   ```

2. **Memory home** — resolves to `<data store>/manda` by default
   (`MANDA_DATA_DIR` or the config `manda_data_dir` override it). A
   directory this agent alone writes. Memory is ON as soon as a manda
   binary resolves — no env var required.

3. **The first mandate** — granted by YOU, out of band, never through
   the agent:

   ```sh
   nunc-stans-agent mandate-template 'notes/*' | tail -1 >> "$MANDA_DATA_DIR/mandates.jsonl"
   ```

</details>

## Use

```sh
just agent            # = node agents/nunc-stans-agent/src/cli.ts chat
nunc-stans-agent chat --profile local-chat
```

In the REPL: plain text chats (streaming, visible thinking, the
goal-verify loop when the profile turns it on); `/remember <scope>
<text>` proposes a memory and commits only on your interactive
approval (manda's elicitation is a real terminal prompt); `/recall
<scope>` reads (≤3 surfaced, audited); `/mandates` shows authority
state; `/exit` leaves.

Every model call lands in `<data store>/runs/ai-runs.jsonl` with the
profile stamp — the Formans **Runs** view reads it.

`nunc-stans-agent doctor` checks the binary, the data dir, and the
mandate state.
