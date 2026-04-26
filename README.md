# news

*Available in: [日本語](README.ja.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

Future predictions news + dashboard.

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — future-prediction dashboard
- `report/` — daily news reports
- `future-prediction/` — daily check of yesterday's news Future column against today

---

## 2026-04-26

### News

- **Claude Code v2.1.120 retracted Apr 25 over `--resume` / `--continue` startup crash; auto-update force-rolls back to v2.1.119** — `g9H is not a function` error, bundled Antigravity binary halts with exit code 1. **8 regressions surface together** in v2.1.119/v2.1.120 across Apr 24-25 (broken auto-update, silent model swap, UI duplication, WSL2 `/mcp` freeze, ignored `CLAUDE.md`, sandbox.excludedCommands, macOS worktree hang, two `--resume` crashes); the community converges on `claude install 2.1.117` as the manual downgrade.
- **OpenClaw v2026.4.24 (released Apr 25) — Real-time voice calls for every agent + Google Meet bundle + DeepSeek V4 Flash/Pro by default** — Chrome/Twilio realtime sessions, Google Meet agent participation (personal Google auth / artifact / attendance export), DeepSeek V4 Flash as onboarding default, browser automation with coordinate clicks / multi-window switching / per-profile headless override, sweeping fixes across Telegram / Slack / MCP / sessions / TTS.
- **DeepSeek V4 launch goes "full-stack" between Apr 24 and Apr 25 — SGLang + Miles Day-0 inference + RL training + V4-Pro API 75% off (until May 5)** — LMSYS / Radixark light up SGLang for V4 hybrid sparse attention end to end with **ShadowRadix prefix cache / HiSparse CPU-extended KV / MTP speculative decoding / Flash Compressor / Lightning TopK**, and Miles delivers Day-0 verified RL with **R3 + indexer replay's Step-0 train-inference diff 0.02-0.03 / Tilelang FP8/BF16 rollout / Hopper/Blackwell/Grace Blackwell parallelism**. **V4-Pro API at 75% off becomes ~28x cheaper than Claude Opus 4.7** (vs ~7x before the discount).
- **Bloomberg (Apr 26): the real reason for DeepSeek V4's delayed release is "a strategic shift to Huawei Ascend integration," reports a CCTV-affiliated outlet "Yuyuantantian"** — The originally-planned February-March V4 launch slipped because **"DeepSeek spent months optimizing the software stack for Huawei Ascend chips."** Beijing's AI-chip self-reliance line under U.S. export controls is now visibly aligned with DeepSeek.
- **CISA adds 4 to KEV on Apr 24 + Federal remediation deadline May 8** — CVE-2024-7399 (Samsung MagicINFO 9 Path Traversal, CVSS 8.8), CVE-2024-57726 (SimpleHelp Missing Authorization, CVSS 9.9), CVE-2024-57728 (SimpleHelp Path Traversal, CVSS 7.2), CVE-2025-29635 (D-Link DIR-823X Command Injection) — all under "actively exploited in the wild."
- **Anthropic MCP Design Vulnerability (OX Security disclosure, spreading Apr 23-24) — 200,000-server RCE risk, design-level defect** — A design flaw in the MCP SDK STDIO interface allowing "config → command execution" directly. Affects Python / TypeScript / Java / Rust implementations, rippling through 150M downloads. OX Security's poison test of 11 MCP registries succeeded on 9 / produced command execution on 6 production platforms. **Anthropic dismisses CVE as "expected behavior";** researchers issue 10+ individual-package CVEs (CVE-2026-30623 LiteLLM / CVE-2026-33224 Bisheng / etc.).
- **Comment and Control attack (Claude Code / Gemini CLI / GitHub Copilot Agent prompt injection via GitHub comments, disclosed Apr 21, spreading Apr 23-24) — Anthropic CVSS 9.4 ($100) / Google ($1,337) / GitHub ($500) bounty** — Hidden HTML-comment payloads in PR titles / Issue comments hijack all 3 vendors' parts simultaneously and steal CI secrets. **3 vendors silently patched with no CVE assigned**, disabling vulnerability scanners.
- **LMDeploy CVE-2026-33626 (CVSS 7.5, SSRF) real-world attack detected 12h31m after disclosure (spreading Apr 24)** — `load_image()` SSRF enables AWS IMDS / Redis / MySQL port scanning → Sysdig honeypot detects an attack at Apr 22 03:35 UTC. AI-inference-engine "publish → exploit" gap shrinks to **the 12-hour zone**.
- **Vercel / Context.ai supply-chain breach (disclosed Apr 19-20, analyses spreading Apr 23-24) — Lumma Stealer → Context.ai employee → Vercel employee OAuth Allow All → Google Workspace takeover → env-var enumeration → $2M data sale** — The first major case of an AI tool's OAuth supply-chain breach; Vercel revises the enterprise Google Workspace config that allowed "Allow All" scope.
- **Hannover Messe 2026 closes with Physical AI as first central theme (Apr 20-24)** — 100+ partners including Siemens / Foxconn / FANUC / KUKA / Universal Robots, with Mega Omniverse Blueprint / Cosmos / Isaac GR00T / Agility Digit / Figure 02 / Apptronik Apollo / Humanoid HMND 01 / Hexagon AEON / Agile ONE exhibited side by side. Manila Times calls **$4T market / mass adoption phase**.
- **Tesla Earth Day (Apr 25) + Optimus Plant Cube limited giveaway + Optimus Earth Day Tee on sale** — At U.S. Tesla flagship stores, FSD (Supervised) demo-drive participants get a **Plant Cube** planted by Optimus, with the **Optimus Earth Day Tee ($40)** on sale at the online shop.
- **Big Tech earnings Super Week ahead (as of Apr 26 weekend) — MSFT / GOOGL / META / AMZN on Apr 29, AAPL on Apr 30** — Microsoft expects Azure +28% YoY, Alphabet FY26 capex $175-185B, Meta FY26 capex $115-135B / FY27 $142B consensus. Investor focus shifts to **"over-investment concern → proof of capex's revenue / profit / monetization."**
- **Microsoft IKE Service Extensions CVE-2026-33824 (CVSS 9.8, RCE, UDP 500/4500, Apr 22 ZDI detail)** — Windows IKEv2 double free flaw (CWE-415); an unauthenticated remote attacker can RCE via UDP 500/4500. Patched at the 4/14 Patch Tuesday, but exploitation attempts against unpatched envs continue to grow.
- **llama.cpp build b8936 (Apr 26 03:28 UTC) — AVX2 Q6_K optimization** — `ggml-cpu: optimize avx2 q6_k (#22345)` lands on main; full multi-platform binaries (macOS / iOS / Linux / Android / Windows + CPU / Vulkan / ROCm / OpenVINO / SYCL / CUDA backends) ship Apr 26.
- **Simon Willison `GPT-5.5 prompting guide` + `WHY ARE YOU LIKE THIS` + Romain Huet quote (Apr 25)** — The OpenAI official prompting guide release kicks off the community's GPT-5.5 verification phase.

[news-20260426.md](report/en/news-20260426.md)

### Validation

- 18 predictions validated over the past week. Continuous **Relevance 5** validation across 8 axes: **MCP-protocol attack surface / OAuth trust / Physical AI SaaS-ization / 1M-context open-weight standard / proprietary × open split / indirect prompt injection becoming primary CVE / Agent Control Plane / CI Secret leak**.
- **MCP / AI integration-layer structural vulnerabilities exposed simultaneously (4/25-3 + 4/19-3)** Relevance 5: Anthropic MCP Design Vulnerability + Comment and Control attack + LMDeploy SSRF, three in succession. Today's Future #3 explicitly states **"OWASP LLM Top 10 v2026 elevates Supply Chain Compromise via AI Integration to #1."**
- **OAuth trust + Agent Control Plane (4/22-3 + 4/23-1)** Relevance 5: Vercel / Context.ai supply-chain breach reconstructed (Lumma Stealer → OAuth Allow All → $2M sale) + Okta for AI Agents Apr 30 GA countdown + Google Cloud Next '26 Gemini Enterprise Agent Platform centerpiece (260 announcements) + AWS Bedrock AgentCore CLI / Skills staged rollout — four axes in parallel reach the real commercial-launch phase.
- **Physical AI SaaS / RaaS-ization + 8h production runs = procurement requirement (4/22-2 + 4/24-2 + 4/25-2)** Relevance 4-5: Hannover Messe 2026 Physical AI as first central theme, Manila Times $4T market / mass adoption phase, Tesla Optimus Plant Cube giveaway reaches "user-physical-handoff" phase, Agile ONE's shoe-production-line live system.
- **Proprietary × open split + hyperscaler exclusive alliance (4/21-3 + 4/21-2 + 4/25-1)** Relevance 4-5: Bloomberg Apr 26 makes **"DeepSeek V4 delay = strategic shift to Huawei Ascend integration"** officially visible; the **4-pole scenario** (US 3 vs China Huawei Ascend) emerges; DeepSeek V4-Pro API 75% off makes it 28x cheaper than Claude Opus 4.7.
- **1M context as default (4/24-1)** Relevance 5: DeepSeek V4-Pro / V4-Flash both at Hybrid Attention + 1M context; SGLang + Miles' Day-0 verified RL realizes "inference + RL training of a 1M-context frontier model running on launch day."
- **Relevance 1-3**: Headless Everything (4/20-3, Relevance 2 — OpenClaw per-profile headless override one step forward, but full-agent voice / Meet participation moves opposite); 1-bit native learning (4/19-1, Relevance 2 — only continued Bonsai-8B intro, no new Qwen / Llama derivatives); SKU split (4/22-1, Relevance 2 — thin on hyperscaler in-house chip side); local > cloud inversion (4/20-1, Relevance 3 — DeepSeek V4-Pro 75% off counter-pressure).
- User Prediction 1 (malicious local LLM → malware): Anthropic MCP Design Vulnerability (design defect, CVE denial) + Comment and Control (3-vendor silent patch + no CVE disables behavior monitoring) + Vercel / Context.ai chain + LMDeploy SSRF exposed simultaneously. Strongly underwrites the user prediction's **"zero-trust + AI-only-inaccessible-path design,"** with Okta for AI Agents Apr 30 GA + Microsoft ZT4AI consolidating market response.
- User Prediction 2 (cloud vs local split, SaaS price increases): **mixed state of opposite direction and alignment** — DeepSeek V4-Pro API 75% off (28x cheaper) crashes the cloud side; OpenClaw makes V4 Flash the onboarding default, biasing toward "cloud as default." On the other hand, Big Tech capex stays sticky (MSFT FY26 $146B / GOOGL $175-185B / META $115-135B) + Chinese LLM × Huawei Ascend geopolitical split preserves the long-term structure.
- User Prediction 3 (RL/LLM-based prediction improvement): no direct case today. SGLang + Miles' Day-0 verified RL (Step-0 train-inference diff 0.02-0.03) advances the democratization of RL training infrastructure — the prediction's preconditions are consolidating.

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

### Validation

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

### Validation

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
