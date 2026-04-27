# news

*Available in: [日本語](README.ja.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

Future predictions news + dashboard.

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — future-prediction dashboard
- `report/` — daily news reports
- `future-prediction/` — daily check of yesterday's news Future column against today

---

## 2026-04-26

### News

- **Google commits up to $40B to Anthropic on Apr 24 — $10B initial cash at $350B valuation, plus $30B milestone-tied + 5GW Google Cloud capacity over 5 years (Bloomberg)** — Lands days after Amazon's $25B + 5GW Trainium2/3 commit. **All 3 frontier labs (Anthropic / OpenAI / Thinking Machines Lab) now have a hyperscaler underwriter on the cap table** — paid partly in compute capacity, not cash.
- **DeepSeek V4 lands with 9.5x-13.7x lower memory + Huawei Ascend co-tuning; Apr 26 Bloomberg-CCTV piece confirms domestic-chip pivot** — V4-Pro (1.6T MoE / 49B active) and V4-Flash ship with **Hybrid Attention** cutting memory **9.5x-13.7x vs V3.2**, native 1M-token context. Apr 26 Bloomberg via CCTV social account confirms the V4 timeline shift was driven by **Huawei Ascend hardware-specific tuning**. V4-Pro priced at $1.74 / $3.48 per M tokens — **~7x cheaper than Claude Opus 4.7** at GPT-5.4 / Opus 4.6-class quality.
- **SGLang CVE-2026-5760 (CVSS 9.8) — RCE via malicious GGUF chat_template (Jinja2 SSTI), public PoC + CERT/CC VU#915947** — A crafted GGUF file with Jinja2 SSTI in `tokenizer.chat_template` + Qwen3 reranker trigger phrase fires inside `entrypoints/openai/serving_rerank.py`; SGLang renders the template via `jinja2.Environment()` → arbitrary code execution. **Public PoC at `github.com/Stuub/SGLang-0.5.9-RCE`**, CERT/CC VU#915947 issued, recommended fix `ImmutableSandboxedEnvironment`. AI inference servers now confirmed as **post-LMDeploy SSRF, second weaponized AI-infra primitive**.
- **Qwen3.6-27B (Apr 22, traction Apr 23-26) — Apache 2.0 dense 27B beats 397B-A17B MoE on coding** — SWE-bench Verified **77.2% vs 76.2%**, Terminal-Bench 2.0 59.3 matches Claude Opus 4.5; **40 tok/s on RTX 3090 at Q4_K_M ~16.8 GB VRAM**, 262K context (extensible to 1M), new **Thinking Preservation** mechanism. Sets a new "single-GPU coding agent" baseline.
- **Microsoft ASP.NET Core CVE-2026-40372 (CVSS 9.1) — out-of-band emergency patch for SYSTEM-privilege cookie-forging flaw in DataProtection 10.0.0-10.0.6** — `ManagedAuthenticatedEncryptor` computes the HMAC validation tag at an incorrect offset; a ciphertext with all-zero HMAC tag is incorrectly accepted as valid. Enables forging authentication cookies, manipulating antiforgery tokens, decrypting protected payloads — full impersonation up to SYSTEM. Fixed in `Microsoft.AspNetCore.DataProtection 10.0.7`. Requires **rotating DataProtection key ring + auditing long-lived tokens issued during the vulnerable window**.
- **OpenClaw v2026.4.25-beta train (Apr 26, beta.3-7+) — voice reply / TTS upgrades, 6 new TTS providers** — Azure Speech / Xiaomi / Local CLI / Inworld / Volcengine / ElevenLabs v3. **beta.3 (13:00 Apr 26) → beta.4 (13:24 Apr 26) → beta.7+ ships in a single afternoon** — release tempo is sub-24h under continuous voice-stack hardening. Voice reply moves from "available" to "production-shaped."
- **Pillar Security: Antigravity prompt-injection sandbox escape via `find_by_name -X` exec-batch flag (Google patched, bug bounty paid)** — The `find_by_name` Pattern parameter inserts `-X` into `fd`, achieving RCE despite Antigravity's Secure Mode. **A third agentic-IDE vendor confirmed vulnerable to comment-style prompt-injection class.**
- **Anthropic engineering postmortem on Apr 23 Claude Code regression — March 4 reasoning cut + April 16 verbosity-prompt issue, fixed Apr 20 in v2.1.116** — Anthropic's official postmortem at anthropic.com/engineering/april-23-postmortem frames **two distinct weeks-long quality regressions** in Claude Code + Agent SDK + Cowork that fooled users into blaming themselves.
- **Claude Code v2.1.119 / v2.1.120 24-hour regression cluster (Apr 24-25)** — **8 regressions ship in 24 hours**: retract-grade auto-update break, silent model swap, two resume-time crashes, UI-duplication bug, WSL2-only `/mcp` freeze, CLAUDE.md-is-ignored regression, broken `sandbox.excludedCommands` promise, macOS worktree hang. Survival checklist points users back to v2.1.117 rollback.
- **Indirect prompt injection in the wild — Google Online Security Blog + Help Net Security Apr 24, 32% YoY rise Nov 2025-Feb 2026** — Google's primary research piece quantifies **a 32% increase in malicious prompt-injection content** crawled across the open web, with **10 confirmed in-the-wild IPI attacks** documented — the threat generalizes from "GitHub comments" to **"the open web."**
- **Ollama MLX backend Apr 23 deep-dive (gingter.org) — Foundry Local stays Metal-only, MLX gap widens** — Ollama on M5 Max sees **1.57x prefill / 1.93x decode on Qwen3.5-35B-A3B with NVFP4**; Foundry Local's MLX support remains an open issue (`microsoft/Foundry-Local#329`).
- **llama.cpp builds b8936 + b8937 land within an hour on Apr 26 (08:54 + 09:28 UTC)** — Two builds within a single hour on a Sunday — breaking the prior "no-window-release" pattern.
- **NVIDIA $5T market cap retake + AMD +13.9% + Nasdaq / S&P 500 records (Apr 24, carry-forward)** — Intel Q1 2026 beat (EPS $0.29 vs $0.01, revenue $13.6B +7% YoY, +24% close on Apr 24 — best single-day move since 1987) is now consolidated as the catalyst, with iShares Semiconductor ETF +40.4% MTD through Apr 24.

[news-20260426.md](report/en/news-20260426.md)

### Predictions check

- **17 predictions checked over the past week (4/19-4/25). 8 hit Relevance 5, 4 hit Relevance 4, 5 sit at Relevance 1-2.**
- **Indirect prompt injection as top CVE category (4/19)** Relevance 5: triple-confirmed by **SGLang CVE-2026-5760 + Pillar Antigravity + Google IPI 32% YoY**.
- **Local-first cloud-overflow inversion (4/20)** Relevance 5: codified explicitly in today's own Future #3 — **"consumer-GPU coding agent displaces cloud-only coding API for ≥30% of dev workloads by Q3 2026."** Driven by Qwen3.6-27B + Ollama MLX + DeepSeek V4-Pro 3-corner squeeze.
- **GGUF supply-chain prediction (4/21)** Relevance 5: lands decisively with **PoC + CERT/CC VU#915947 for SGLang's chat_template SSTI** — same vulnerability class as CVE-2024-34359 ("Llama Drama") on llama-cpp-python.
- **Hyperscaler-frontier-lab 5-pole regime (4/21)** Relevance 5: Big-3-confirmed via the **Google × Anthropic $40B / 5GW deal** completing the trio (Amazon $25B + Microsoft $13B+ + Google $40B). Today's Future #1 explicitly predicts that by Q3 2026, **enterprise multi-cloud LLM strategy shifts from "multi-runtime" to "multi-frontier-vendor."**
- **Proprietary vs open-weight split (4/21)** Relevance 5: sharpens via **GPT-5.5 API +2x** vs **DeepSeek V4-Pro at ~7x cheaper** landing the same window; Apr 26 Bloomberg-via-CCTV piece officially aligns DeepSeek V4 with Huawei Ascend.
- **Agent Registry / OAuth trust / Agent Control Plane (4/19, 4/22, 4/23)** Relevance 5: all converge on **Okta's Showcase 2026 blueprint with Agent Gateway as central MCP control plane**, Cross App Access protocol, TrueFoundry's MCP Security / Zero Trust guide.
- **27B-dense + 1M-context standard (4/23)** Relevance 5: decisively delivered by **Qwen3.6-27B beating a 397B-A17B MoE on SWE-bench Verified at consumer-GPU price points** (40 tok/s on RTX 3090 Q4_K_M ~16.8 GB).
- **Three-cloud oligopoly thesis (4/25)** Relevance 5 — keystone validation of the day. Anthropic annual run-rate revenue past **$30B** (vs ~$9B end-2025).
- **Relevance 4**: secret-leakage-through-CI-and-agents (4/20, Pillar's third agentic-IDE RCE); Physical-AI-as-RaaS (4/22, BMW Leipzig + Tesla Earth Day + Hannover Messe); 1M-context-default-open-weight (4/24, DeepSeek V4 + Qwen3.6-27B); MCP-protocol-attack-surface (4/25, threat + defense in same window).
- **Relevance 1-2**: 1-bit native training (4/19), Headless Everything (4/20), Training-vs-inference SKU split (4/22) see no direct progress today. Third-party-vendor-boundary (4/23) and SaaS-displacement-valuation reset (4/24) register only weak signals — today's market action is hardware-rally-driven (NVIDIA $5T retake / AMD +13.9% / Intel +24%) rather than the predicted Workday / Atlassian / Box / Smartsheet 15%+ chained falls.
- User Prediction 1 (malicious local LLM → malware): **strong corroboration**. SGLang CVE-2026-5760 is exactly the failure mode — a model file (GGUF) carries executable code (Jinja2 SSTI in `tokenizer.chat_template`) that fires inside the inference server; public PoC + CERT/CC VU#915947 weaponize it. Okta's Agent Gateway as central MCP control plane + TrueFoundry's "MCP Security: Guide to Zero Trust for Agentic AI" formalize the **"intentionally design system paths AI alone cannot access"** architecture as a real product category.
- User Prediction 2 (cloud vs local split, SaaS price increases): **direct codified confirmation**. Today's Future #3 explicitly: **"consumer-GPU coding agent displaces cloud-only coding API for ≥30% of dev workloads by Q3 2026."** GPT-5.5 API at $5 / $30 (2x increase, with Codex cutting output tokens ~40% to "offset per-token raise via per-task cost") lands the same week DeepSeek V4-Pro shipped at ~7x cheaper than Claude Opus 4.7.
- User Prediction 3 (RL/LLM-based forecasting): no direct case today. Closest adjacent is the Anthropic engineering postmortem (a quality-regression analysis, not a forecasting-improvement piece). Carry-only.

[future-prediction-20260426.md](future-prediction/en/future-prediction-20260426.md)

---

## 2026-04-25

### News

- **NVIDIA retakes a $5.12T market cap on Apr 24 close** — Intel's after-close beat on Apr 23 lights up the chip sector. NVIDIA closes at a record $208.27 (+4.3%); the gap to Alphabet widens past $1T. AMD adds another **+13.90% ($347.77)** the same day (May 5 print), Nasdaq Composite **+1.63% / 24,836.60**, S&P 500 **+0.80% / 7,165.08** — both at records.
- **Tesla turns Apr 25 into Earth Day marketing, gives away limited Optimus V3 "Plant Cubes"** — At U.S. flagship stores, FSD (Supervised) demo-drive participants get a Plant Cube planted by Optimus. The Apr 23 print reaffirmed **V3 mid-2026 debut / July-August mass-production**, with 2026 capex officially guided above $25B; Fremont preps for 1M units / year, with a planned second factory at Giga Texas at 10M units / year.
- **Google Cloud × Thinking Machines Lab: a multi-billion-dollar GB300 deal (announced Apr 22)** — Mira Murati's TML adopts Google Cloud A4X Max VMs powered by NVIDIA **GB300**; training / serving speed is **2x** the prior generation. The third Google Cloud frontier-lab deal after Anthropic and Meta.
- **BMW Group begins serious AEON humanoid trials at Plant Leipzig from April 2026 + opens a Physical AI Center of Competence** — Building on Spartanburg's **Figure 02 record (30,000 X3 vehicles in 10 months / 90,000 parts / 1.2M steps / 1,250 hours)**, BMW opens Europe's first Physical AI hub in Leipzig. Hexagon Robotics' **AEON** (22 sensors / self-swap battery / 4-layer Physical AI / autonomy in 20 demos) enters serious trial from April 2026 on the path to a summer pilot.
- **Hannover Messe 2026 (Apr 20-24) closes with Physical AI as first central theme** — 130,000 visitors / 4,000 exhibitors / 1,600 speakers; AEON / HMND 01 / Apptronik Apollo / Agility Digit exhibited side by side.
- **OpenAI GPT-5.5 / GPT-5.5 Pro API public on Apr 24** — input $5.00 / output $30.00 per M tokens (**2x increase** vs GPT-5.4); Pro at $30 / $180. Codex cuts output tokens ~40% to offset per-task cost.
- **DeepSeek V4 Pro detailed benchmarks** — IMOAnswerBench **89.8** (above Claude Opus 4.7 75.3 / Gemini 3.1-Pro 81.0, near GPT-5.4 91.4); agentic above Sonnet 4.5, Opus 4.5-class. Pricing: **$1.74 input / $3.48 output per M tokens (1/7 of Opus 4.7)**, Apache 2.0, Huawei Ascend tight integration.
- **Claude Code v2.1.117 (Apr 25)** — `/resume` auto-summarizes stalled / large sessions before reload to prevent context overflow; a model selection different from the project pin persists across restarts; boot header shows model source; `CLAUDE_CODE_FORK_SUBAGENT=1` enables forking subagent via external builds; mcpServers auto-loaded via `--agent`.
- **OpenClaw v2026.4.23 (Apr 24)** — Adds image gen + reference-image editing via Codex OAuth in Providers/OpenAI (no OPENAI_API_KEY needed for `openai/gpt-image-2`); also adds image gen + reference-image editing via the `image_generate` API in Providers/OpenRouter.
- **AWS Bedrock AgentCore Browser adds OS-level interaction (Apr 22)** — file upload / OS dialog handling / multi-window switching, letting agents talk to the host OS beyond "inside the browser."
- **Salesforce Q4: Agentforce ARR $800M / 29,000 deals (+50% QoQ)** — FY2026 revenue $41.5B, Q4 EPS $3.81 / revenue $11.20B (+12.1% YoY). The "decline vs accelerate" split with ServiceNow sharpens.
- **Nginx UI CVE-2026-33032 (MCPwn, CVSS 9.8) actively exploited in the wild** — `/mcp_message` endpoint with empty default IP allowlist bypasses auth middleware; 12 unauthenticated MCP tool calls exposed; 2 HTTP requests to fully take over Nginx. Recorded Future Top 31 actively-exploited March 2026, **2,600+ instances exposed on Shodan**, fixed in v2.3.4.
- **CISA adds 4 to KEV on Apr 24** — CVE-2024-7399 (Samsung MagicINFO 9) / CVE-2024-57726 (SimpleHelp Missing Authorization) / CVE-2024-57728 (SimpleHelp Path Traversal) / CVE-2025-29635 (D-Link DIR-823X Command Injection), all actively exploited.
- **Saltcorn CVE-2026-41478 (CVSS 9.9) disclosed (Apr 24)** — Mobile-Sync SQL injection: an authenticated low-privilege user can inject arbitrary SQL, leaking the full DB including admin password hashes / config secrets. Fixed in 1.4.6 / 1.5.6 / 1.6.0-beta.5.
- **Amazon × Anthropic added $25B + 5GW Trainium2/3 capacity (Apr 20 detail finalized)** — $5B immediate + $20B milestone-tied; Anthropic commits 10-year $100B to AWS; 1GW Trainium2/3 simultaneous run by year-end 2026.
- **AI Tinkerers SF + AI Dev 26 x SF + Sage Future running back-to-back (Apr 28-30)** — Apr 29 AI Tinkerers SF VIP Dinner (Building Software Factories with Kiro & B-Capital), Apr 28-29 AI Dev 26 x SF @ Pier 48 (3,000+ developers), Apr 28-30 Sage Future @ Moscone Center.

[news-20260425.md](report/en/news-20260425.md)

### Predictions check

- 17 predictions validated over the past week. Continuous **Relevance 5** validation across 6 axes: **Agent Control Plane / OAuth trust / Physical AI SaaS-ization / 1M-context open-weight standard / hyperscaler × frontier-lab exclusive alliance / proprietary × open split**.
- **Proprietary × open split (4/21-3)** Relevance 5: GPT-5.5 API 2x increase × DeepSeek V4 Pro 7x price destruction in **same-day release** seal the case. The structure of Apus 4.5-class running locally on Apache 2.0 open weights.
- **Hyperscaler × frontier-lab exclusive alliance (4/21-2)** Relevance 5: Google × Thinking Machines Lab GB300 deal confirms #3; Amazon × Anthropic $25B + 5GW Trainium capacity + 10-year $100B detail finalized; with Vera Rubin 7-chip mass production, the two-tier "training = 3-cloud oligopoly / inference = layered" structure locks in.
- **Physical AI SaaS / RaaS-ization (4/22-2)** Relevance 5: BMW Leipzig AEON Apr 2026 trial + Spartanburg Figure 02's 10 months / 30,000 vehicles record + Hannover Messe 2026 Physical AI as first central theme + Tesla Optimus Earth Day Plant Cube giveaway sync — the structural transition to RaaS / fleet-management SaaS becomes visible.
- **Physical AI 8h production = procurement requirement (4/24-2)** Relevance 5: BMW Spartanburg Figure 02's 1,250 hours of operation locked in; IROS October / GTC Fall 2026 league tables for "OEM adoption count × continuous-operation hours × MTBF" loom.
- **Agent Control Plane (4/23-1)** Relevance 5: Okta for AI Agents Apr 30 GA countdown + AWS Bedrock AgentCore Browser OS-level + Managed Harness CLI / Skills + Salesforce Agentforce ARR $800M / 29,000 deals (+50% QoQ) — the billing engine ramps in earnest.
- **OAuth trust (4/22-3)** Relevance 5: Okta for AI Agents pre-GA stage as "the company's most important product"; Microsoft Copilot Studio CVE-2026-21520 with Capsule Security flatly stating "patches alone won't close indirect prompt injection" — enterprise MCP / agent connection-point auditing becomes mandatory.
- **1M context as default (4/24-1)** Relevance 5: DeepSeek V4 Pro Hybrid Attention cuts long-context inference cost to 27% of V3.2 / KV cache compressed by 10%, Apache 2.0 reignites the "1M token race."
- **Agent Registry (4/19-2)** Relevance 5: Okta for AI Agents' Agent Gateway / MCP virtual server / Okta MCP registry + AWS Bedrock AgentCore Managed Harness + CLI + Skills (Kiro Power immediately / Claude Code, Codex, Cursor next week) — the distribution layer is being assembled.
- **Relevance 1-2**: Headless Everything (4/20-3, Relevance 1) — counter-direction with AgentCore Browser OS-level expansion. 1-bit native learning (4/19-1, Relevance 1) — no new Qwen / Llama derivatives. SKU split (4/22-1, Relevance 2) and CI Secret leak OWASP elevation (4/20-2, Relevance 2) — no direct progress today.
- User Prediction 1 (malicious local LLM → malware): the **Nginx UI CVE-2026-33032 (MCPwn)** makes the structural defect of the MCP-protocol integration layer itself a malware path. Today's Future #3 predicts "OWASP MCP Top 10 official publication / industry standardization of MCP-over-mTLS / MCP Gateway / Firewall product Q4 launches by Keycard / Okta / Wiz / Levo.ai / Pillar Security" — strong corroboration.
- User Prediction 2 (cloud vs local split, SaaS price increases): the **same-day GPT-5.5 API 2x increase × DeepSeek V4 Pro 7x price destruction** contrast makes this **the most accurate prediction of the week**. "Pricing-system change leads" lands decisively; "role split" advances as Opus 4.5-class runs locally on Apache 2.0.
- User Prediction 3 (spread of RL/LLM-based prediction improvement): no direct case today. Adjacent signals: Claude Code v2.1.117 `/resume` auto-summary + DeepSeek V4 Hybrid Attention + GPT-5.5 Codex 40% output reduction.

[future-prediction-20260425.md](future-prediction/en/future-prediction-20260425.md)

---

## 2026-04-24

### News

- **DeepSeek V4 Preview ships** — V4-Pro (1.6T MoE / 49B active) + V4-Flash (284B / 13B active) drop together; native 1M-token context; Hybrid Attention cuts FLOPs at 1M context to 27% of V3.2 / KV cache to 10%. Open weights on Hugging Face; APIs at Pro $0.145/$3.48 per M tokens. Simon Willison: "frontier-adjacent at fraction of the price."
- **OpenAI GPT-5.5 / GPT-5.5 Pro released (Apr 23)** — Rolled out to ChatGPT Plus/Pro/Business/Enterprise + Codex; SWE-bench **88.7%**, MMLU 92.4%, hallucinations **-60%** vs GPT-5.4. Runs on NVIDIA GB200 NVL72 racks; API price 2x.
- **Intel Q1 2026 earnings: EPS $0.29 / revenue $13.58B blowout, +20%** — Data Center +22% YoY, AI-related at 60% of revenue, +40% YoY. Intel 18A process ramp contributes; six straight quarters of guidance beats.
- **Anthropic publishes a Claude Code quality post-mortem and resets usage caps** — Three changes compounded to drag Sonnet 4.6 / Opus 4.6's intelligence: 3/4 reasoning-effort "high → medium" change + 3/26 idle-time thinking-clear bug + 4/16 verbosity-reduction prompt. All reverted in v2.1.116; usage caps reset across all subs on 4/23.
- **Siemens × Humanoid HMND 01 Alpha 8 hours of autonomous logistics on the Erlangen factory floor** — NVIDIA Physical AI + KinetIQ + Siemens Xcelerator integrated; 60 totes/h × 8h × pick-and-place success rate **above 90%**. Wired into the production line (qualitative jump from PoC to production).
- **The Agentic AI Security solution-provider axis takes shape at once** — On the zero-trust access control side: **Okta for AI Agents (GA 2026-04-30)** registers AI agents in a central directory as first-class identities; **Keycard** ($38M raise, Anchor.dev / Runebook acquisitions + Smallstep partnership) provides Control Plane workload attestation (SPIFFE/mTLS) + dynamic / task-scoped / revocable tokens; **Cisco Zero Trust Access** (Duo IAM + MCP enforcement + intent-aware monitoring); **Microsoft Zero Trust for AI** (Entra Agent ID + Purview + Defender for AI); **CSA Agentic Trust Framework** (vendor-neutral Zero Trust spec); **Wiz AI-APP** (under Google Cloud, code-to-runtime); **CrowdStrike / Palo Alto** as Project Glasswing launch partners. On the behavior analytics side: **Exabeam Agent Behavior Analytics** establishes "AI Insider Threat" + covers all 10 of OWASP Agentic Top 10 + 2026 Google Cloud Partner of the Year; **Zenity** (2 categories on Gartner Hype Cycle + Fortune Cyber 60 + FedRAMP In Process); **Arize / Braintrust / Galileo / Fiddler / Levo.ai / LangSmith** join.
- **Tencent Hunyuan Hy3 Preview open-sourced**, **0G × Alibaba Qwen on-chain partnership**, **Qwen3.6-27B** continues to spread — three Chinese AI labs deliver open-weight frontiers in the same week.
- **ServiceNow -18% post-print (YTD 2026 -45%)**; Salesforce / Workday / Oracle / IBM chain-fall — "AI disruption on legacy SaaS" becomes its own theme.
- **Tesla Optimus V3 mass-production timeline confirmed** — Fremont's Model S/X line repurposed; July-August mass-production; first-gen factory at 1M / year; Giga Texas's second factory at 10M; 2026 capex >$25B.
- **AWS Bedrock AgentCore Managed Harness detailed spec** — 3 API calls and you're running, filesystem persistence, AgentCore CLI, pre-built coding skills, US/EU/APAC preview.
- **Google Cloud Next '26 Day 3** — Agentic Data Cloud + Agentic Defense, Workspace Skills / Meet "Take Notes For Me," TPU 8i (inference-optimized / SRAM 3x).
- **Anthropic Project Glasswing 40+ orgs onboard** — AWS / Apple / Google / MS / NVIDIA / JPMorgan / Linux Foundation et al. $100M Mythos credit + $4M open-source donation.
- **Major CVEs disclosed**: ToToLink A3300R 9.8 / Ntfy parseActions 9.8 / Kofax Capture 9.8 / hackage-server 9.9 / Pipecat 9.8. CISA KEV adds **Marimo Pre-Auth RCE (CVE-2026-39987)**, federal deadline May 7.
- **Mercor data leak class action** — 4TB / facial biometrics / API keys leaked via TeamPCP through LiteLLM CI/CD; 7+ class actions filed; chained with Anthropic Mythos Preview intrusion (Proofpoint).
- **At RSAC 2026, CrowdStrike / Cisco / Palo Alto ship agentic SOC tools at once**, but agent-telemetry standardization is a shared gap (VentureBeat analysis).

[news-20260424.md](report/en/news-20260424.md)

### Predictions check

- 15 predictions validated over the past week (updated edition). **Relevance 5: 8 entries** / 4: 2 / 3: 3 / 2: 1 / 1: 1. The updated edition includes a decisive new section (Zero-trust Access Control + Agent Behavior Analytics) that strongly underwrites the 4 predictions on Agent Control Plane / OAuth trust / third-party-vendor boundary / Agent Registry.
- **Agent Registry (4/19-2)** Relevance **3 → 5**: Okta for AI Agents (Apr 30 GA) + Keycard Control Plane bring artifact / permission / audit distribution to concrete products.
- **Secret leak OWASP elevation (4/20-2)** Relevance 5 sustained / concrete: Exabeam establishes "AI Insider Threat" + **all 10 OWASP Agentic Top 10 categories covered** — predicted framework elevation lands as a real commercial product.
- **OAuth trust (4/22-3)** Relevance **4 → 5**: Okta for AI Agents + Cisco Duo IAM + MCP policy + Microsoft Entra Agent ID + CSA Agentic Trust Framework — all deploying together; the "SSO carving the AI extension scope" prediction lands head-on.
- **Third-party-vendor boundary (4/23-3)** Relevance 5 sustained / extended: Zenity FedRAMP In Process + Microsoft Zero Trust for AI (data ingest through behavior) + CSA ATF — vendor-neutral governance is concrete.
- **Agent Control Plane (4/23-1)** Relevance 5 sustained / market-maturation phase: AWS / Google / Okta / Keycard / Cisco / Microsoft sync; at RSAC 2026 CrowdStrike / Cisco / Palo Alto ship agentic SOC, but agent-telemetry standardization is a shared gap.
- **Other Relevance 5**: indirect prompt injection CVE-ization (4/19-3, 10 in-the-wild + Antigravity RCE + CVE-2026-21520); proprietary re-expansion × open geopolitical split (4/21-3, DeepSeek V4 + Tencent Hy3 + GPT-5.5 2x); Physical AI SaaS / RaaS-ization (4/22-2, Siemens × Humanoid 8h production).
- **Relevance 1-2**: Headless Everything (4/20-3, no progress today); GGUF signature-verification standardization (4/21-1, only SGLang / Pipecat CVEs, no standardization).
- User Prediction 1 (malicious local LLM → malware): SGLang / Pipecat CVE RCE paths + 10 Indirect PI + Exabeam "AI Insider Threat" + Levo.ai eBPF runtime detection — detection / regulation respond in parallel as the local LLM execution layer becomes a malware host.
- User Prediction 2 (RL/LLM-based prediction improvement): no direct case today. Adjacent: Anthropic quality post-mortem + GPT-5.5 planning/tool/self-check + Galileo Luna-2 evaluators (auto-identifies agent drift).
- User Prediction 3 (power / compute scarcity → AI SaaS price increases): **strongest correlation** — GPT-5.5 API 2x, Alphabet 2026 capex $175-185B (2x of 2025), Tesla capex >$25B, ServiceNow and other Legacy SaaS chained-fall, plus a new SaaS billing line at the agent-security layer (Keycard $38M / Okta Showcase / Zenity Fortune Cyber 60) — a two-pole structure of new SaaS billing-line addition.

[future-prediction-20260424.md](future-prediction/en/future-prediction-20260424.md)

---
