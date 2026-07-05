# User standing thesis predictions

The three persistent thesis predictions the daily flow tracks against. Distinct from the day-bound predictions in `app/sourcedata/<date>/predictions.json` (which are the 3 fresh predictions per day) — these are the user's **personal long-running forecasts** that every `compose-summary` run ties today's news back to in the `relation_to_my_preds` field.

Read by:
- `compose-summary` sub-agent (writes `summary.json.relation_to_my_preds` — 3 paragraphs, one per standing pred)
- Anyone reviewing the FP markdown's `## Relation to My Own Predictions` section

## The three

### 1. First standing prediction — malicious local LLM as malware + zero-trust as fundamental safeguard

The thesis: as local-LLM tooling matures, malicious actors will weaponize it (poisoned model files, inference-server exploits, agent-stack CVE chains, supply-chain attacks via model registries). Defense converges on zero-trust attestation as the structural answer: signed checkpoints, per-tenant capability gating, attestation logs, audit trails, federal/allied-cohort procurement gates that tie remediation status to vendor eligibility. Evidence to track:

- Agentic-AI workflow-platform CVE wave (LangGraph / LiteLLM / CrewAI / Haystack / AutoGen / Semantic Kernel / LangChain / n8n etc.)
- MCP-server attack surface telemetry (Sysdig / Adversa / Wiz / Microsoft Defender quarantine rates)
- Federal civilian + allied procurement enforcement (CISA KEV deadlines, NHS England named-CVE blocklist, FMRB executive-order trail)
- Per-tenant capability attestation primitives (Anthropic Project Glasswing / Mythos, Microsoft Agent 365 audit ledger, AWS Bedrock + Vertex AI registry interop, formal-verification preprints)

### 2. Second standing prediction — cloud APIs for advanced + local LLMs for daily (driven by SaaS price rises)

The thesis: AI workloads bifurcate. Advanced / frontier / training workloads stay on hyperscaler-cloud APIs because the substrate cost (GPU capex, training-stack maturity, regulatory perimeter) only amortizes at hyperscaler scale. Daily / commodity / privacy-sensitive workloads move to on-device / on-prem / local-LLM substrates because SaaS-API per-token pricing keeps rising while local-LLM compute envelopes (consumer GPUs, sovereign-cloud, on-prem fine-tuning recipes) keep widening. The user's split: **advanced cloud + daily local**. Evidence to track:

- Cloud-API leg: hyperscaler AI capex disclosures, AI-accelerator IPO cohort pricing (Cerebras / Tenstorrent / SambaNova / Groq), AI-revenue 10-Q segment footnotes, frontier-lab × hyperscaler exclusive alliances, Big-3 AI-services run-rate disclosures
- Local-LLM leg: Unsloth router-only / quantization-aware fine-tuning recipes, Mixtral / Qwen / DeepSeek consumer-GPU envelopes, sovereign-cloud Mistral Workflows tenancy, on-prem orchestration interop (Codex CLI / Claude Code / Workflows cross-vendor), local-first cloud-overflow inversion

### 3. Third standing prediction — RL/LLM-based forecasting performance improvement

The thesis: long-horizon RL training on LLM substrates (Mixture-of-Experts backbones with ultra-long context) becomes the dominant paradigm for autonomous forecasting agents — exploration vs exploitation in token-space, policy-gradient stability across long rollouts, audit-and-attestation perimeters that let an autonomous forecasting agent run inside enterprise-grade procurement gates. Substrate, governance, and real-world-deployment legs all need to harden in parallel. Evidence to track:

- Substrate: router-only LoRA / router-aware advantage decomposition, ultra-long-context RL stability (DeepMind / arxiv preprints), MoE-backbone training recipes, frontier-lab CLI sub-agent dispatch (Claude Code / Codex Plan-Apply)
- Governance: signed-skill registries (Anthropic + OpenAI + 3-hyperscaler interop), per-tenant capability gating, NIST non-human-identity control profile, formal-verification frameworks (compositional safety theorems, capability-attestation leakage proofs)
- Real-world deployment: physical-AI production-line records (Tesla Optimus / Boston Dynamics Atlas / Figure / Apptronik), humanoid-policy LoRA fine-tunes on commodity hardware, OEM-side production-loop closures (BMW / Hyundai / Mercedes / Foxconn)

## Format contract for `relation_to_my_preds`

Every daily `compose-summary` sub-agent output's `relation_to_my_preds` must be **exactly 3 paragraphs**, in **standing-pred order** (1 → 2 → 3). Each paragraph:

- Opens with `The user's [first|second|third] standing prediction (<short label>)` so the section is structurally parseable and visually consistent across days.
- Synthesizes today's evidence (from `news_section.json` + `bridges.json` + `headlines.json`) that lands against THIS standing thesis.
- Uses specific named entities + numerics (no scope prefixes, no hash IDs, no parser anchors).
- Maintains dense-prose register (~3-5 sentences typical, citation-rich nouns).
- Closes with how the day's evidence interacts with the standing thesis (substrate hardening / structural-force confirmation / forcing-function input / etc.).

The section is **not** about today's 3 fresh predictions — those are already covered in `news.md ## Future`, in the FP `## Bridge` section, and in the `validation_rows` table. Repeating them in `relation_to_my_preds` is a writer regression caught retroactively on 2026-05-11.

## Provenance + maintenance

- Authoritative source: this file. Read by `compose-summary` writers via `design/scheduled/2_future_prediction-writer-rules.md §compose-summary`.
- Update cadence: only when the user explicitly evolves their thesis frame. Day-to-day evidence does NOT modify the standing-pred list — that's the whole point. If a thesis lands or is contradicted, the user makes a deliberate edit.
- Backward reference: 2026-05-07, 2026-05-08, 2026-05-09 FP markdown files use the canonical phrasing this doc encodes; consult those for prose-style examples.
