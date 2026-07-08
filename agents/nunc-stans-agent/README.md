# nunc-stans-agent

The first-party terminal agent (v1 plan §2.11): chat with streaming and
visible thinking on any nunc-ai provider (Ollama first-class), with
memory **exclusively through the [manda](https://github.com/baba-yu/manda)
MCP gateway** — the agent proposes, the principal commits, mandates
authorize, everything is audited. No agent writes self-scope
commitments (F3), regardless of profile.

## Setup

1. **manda** (runtime dependency, never vendored):

   ```sh
   cargo install --locked --git https://github.com/baba-yu/manda --tag v0.2.0
   ```

   or point `MANDA_BIN` at a local build
   (`~/manda/target/release/manda`).

2. **Memory home** — one directory this agent alone writes:

   ```sh
   export MANDA_DATA_DIR=~/.local/share/nunc-stans-agent/manda
   ```

3. **A profile** — create one on the Formans Profiles screen (or via the
   gate) and set it as the **Agents** default; `--profile <id>` overrides
   per session. Without one, an ad-hoc mock profile answers (offline).

4. **The first mandate** — granted by YOU, out of band, never through
   the agent:

   ```sh
   nunc-stans-agent mandate-template 'notes/*' | tail -1 >> "$MANDA_DATA_DIR/mandates.jsonl"
   ```

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
