# news

*Available in: [English](README.md) | [日本語](README.ja.md) | [Español](README.es.md)*

Future predictions news + dashboard.

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — future-prediction dashboard
- `report/` — daily news reports
- `future-prediction/` — daily check ng kahapong news Future column laban sa ngayon

---

## 2026-04-26

### News

- **Nag-commit ang Google ng hanggang $40B sa Anthropic noong Apr 24 — $10B initial cash sa $350B valuation, plus $30B milestone-tied + 5GW Google Cloud capacity sa loob ng 5 years (Bloomberg)** — Sumunod days lang pagkatapos ng $25B + 5GW Trainium2/3 commit ng Amazon. **Ang lahat ng 3 frontier labs (Anthropic / OpenAI / Thinking Machines Lab) ay may hyperscaler underwriter na sa cap table** — bayad in part ng compute capacity, hindi cash.
- **Lumapag ang DeepSeek V4 na may 9.5x-13.7x lower memory + Huawei Ascend co-tuning; Apr 26 Bloomberg-CCTV piece nagko-confirm ng domestic-chip pivot** — V4-Pro (1.6T MoE / 49B active) at V4-Flash na may **Hybrid Attention** na nagba-bawas ng memory **9.5x-13.7x vs V3.2**, native 1M-token context. Apr 26 Bloomberg via CCTV social account nagko-confirm na ang V4 timeline shift ay driven ng **Huawei Ascend hardware-specific tuning**. V4-Pro na priced sa $1.74 / $3.48 per M tokens — **~7x mas mura kaysa Claude Opus 4.7** sa GPT-5.4 / Opus 4.6-class quality.
- **SGLang CVE-2026-5760 (CVSS 9.8) — RCE via malicious GGUF chat_template (Jinja2 SSTI), public PoC + CERT/CC VU#915947** — Crafted GGUF file na may Jinja2 SSTI sa `tokenizer.chat_template` + Qwen3 reranker trigger phrase ay nag-aktiba ng vulnerable path sa `entrypoints/openai/serving_rerank.py`; nire-render ng SGLang ang template via `jinja2.Environment()` → arbitrary code execution. **Public PoC sa `github.com/Stuub/SGLang-0.5.9-RCE`**, na-issue ang CERT/CC VU#915947, recommended fix ay `ImmutableSandboxedEnvironment`. AI inference servers nako-confirm na ngayon bilang **post-LMDeploy SSRF, second weaponized AI-infra primitive**.
- **Qwen3.6-27B (Apr 22, traction Apr 23-26) — Apache 2.0 dense 27B nakahihigit sa 397B-A17B MoE sa coding** — SWE-bench Verified **77.2% vs 76.2%**, Terminal-Bench 2.0 59.3 katumbas ng Claude Opus 4.5; **40 tok/s sa RTX 3090 sa Q4_K_M ~16.8 GB VRAM**, 262K context (extensible hanggang 1M), bagong **Thinking Preservation** mechanism. Nagse-set ng bagong "single-GPU coding agent" baseline.
- **Microsoft ASP.NET Core CVE-2026-40372 (CVSS 9.1) — out-of-band emergency patch para sa SYSTEM-privilege cookie-forging defect sa DataProtection 10.0.0-10.0.6** — Kinaku-compute ng `ManagedAuthenticatedEncryptor` ang HMAC validation tag sa maling offset; ang ciphertext na may all-zero HMAC tag ay incorrectly tinatanggap bilang valid. Nagpapahintulot ng **forging authentication cookies, manipulating antiforgery tokens, decrypting protected payloads** — full impersonation hanggang SYSTEM. Naayos sa `Microsoft.AspNetCore.DataProtection 10.0.7`. Kailangan ng **rotating DataProtection key ring + auditing long-lived tokens na in-issue sa vulnerable window**.
- **OpenClaw v2026.4.25-beta train (Apr 26, beta.3-7+) — voice reply / TTS upgrades, 6 bagong TTS providers** — Azure Speech / Xiaomi / Local CLI / Inworld / Volcengine / ElevenLabs v3. **beta.3 (13:00 Apr 26) → beta.4 (13:24 Apr 26) → beta.7+ ships sa loob ng isang hapon lang** — release tempo ay sub-24h sa ilalim ng tuluy-tuloy na voice-stack hardening. Voice reply lumipat mula "available" patungo sa "production-shaped."
- **Pillar Security: Antigravity prompt-injection sandbox escape via `find_by_name -X` exec-batch flag (na-patch ng Google, bug bounty bayad)** — Ang `find_by_name` Pattern parameter ay nag-iinsert ng `-X` sa `fd`, naka-achieve ng RCE sa kabila ng Antigravity Secure Mode. **Ikatlong agentic-IDE vendor confirmed vulnerable sa comment-style prompt-injection class.**
- **Anthropic engineering postmortem sa Apr 23 Claude Code regression — March 4 reasoning cut + April 16 verbosity-prompt issue, na-fix Apr 20 sa v2.1.116** — Opisyal na postmortem ng Anthropic sa anthropic.com/engineering/april-23-postmortem nagba-frame ng **dalawang distinct na weeks-long quality regressions** sa Claude Code + Agent SDK + Cowork na nakakulong sa users na sisihin ang sarili.
- **Claude Code v2.1.119 / v2.1.120 24-hour regression cluster (Apr 24-25)** — **8 regressions ships sa loob ng 24 hours**: retract-grade auto-update break, silent model swap, dalawang resume-time crashes, UI-duplication bug, WSL2-only `/mcp` freeze, CLAUDE.md-is-ignored regression, broken `sandbox.excludedCommands` promise, macOS worktree hang. Survival checklist nagtuturo sa users pabalik sa v2.1.117 rollback.
- **Indirect prompt injection sa wild — Google Online Security Blog + Help Net Security Apr 24, 32% YoY rise sa Nov 2025-Feb 2026** — Primary research piece ng Google nagku-quantify ng **32% increase sa malicious prompt-injection content** na crawled sa open web, na may **10 confirmed in-the-wild IPI attacks** documented — ang threat ay nagge-generalize mula "GitHub comments" patungo sa **"open web."**
- **Ollama MLX backend Apr 23 deep-dive (gingter.org) — Foundry Local nananatiling Metal-only, MLX gap lumalawak** — Ollama sa M5 Max ay nakakakita ng **1.57x prefill / 1.93x decode sa Qwen3.5-35B-A3B na may NVFP4**; ang MLX support ng Foundry Local ay nananatiling open issue (`microsoft/Foundry-Local#329`).
- **llama.cpp builds b8936 + b8937 lumapag sa loob ng isang oras noong Apr 26 (08:54 + 09:28 UTC)** — Dalawang builds sa loob ng isang oras sa Linggo — sumira sa naunang "no-window-release" pattern.
- **NVIDIA $5T market cap retake + AMD +13.9% + Nasdaq / S&P 500 records (Apr 24, carry-forward)** — Intel Q1 2026 beat (EPS $0.29 vs $0.01, revenue $13.6B +7% YoY, +24% close noong Apr 24 — pinakamalaking single-day move mula 1987) ay consolidated bilang catalyst, na may iShares Semiconductor ETF +40.4% MTD hanggang Apr 24.

[news-20260426.md](report/fil/news-20260426.md)

### Predictions check

- **17 predictions checked sa nakalipas na linggo (4/19-4/25). 8 nagre-reach ng Relevance 5, 4 nagre-reach ng Relevance 4, 5 nasa Relevance 1-2.**
- **Indirect prompt injection bilang top CVE category (4/19)** Relevance 5: triple-confirmed ng **SGLang CVE-2026-5760 + Pillar Antigravity + Google IPI 32% YoY**.
- **Local-first cloud-overflow inversion (4/20)** Relevance 5: codified explicitly sa Future #3 ngayon — **"consumer-GPU coding agent nagpapalit sa cloud-only coding API para sa ≥30% ng dev workloads para sa Q3 2026."** Driven ng Qwen3.6-27B + Ollama MLX + DeepSeek V4-Pro 3-corner squeeze.
- **GGUF supply-chain prediction (4/21)** Relevance 5: lumapag nang decisively kasama ang **PoC + CERT/CC VU#915947 para sa SGLang chat_template SSTI** — same vulnerability class ng CVE-2024-34359 ("Llama Drama") sa llama-cpp-python.
- **Hyperscaler-frontier-lab 5-pole regime (4/21)** Relevance 5: Big-3-confirmed via **Google × Anthropic $40B / 5GW deal** na kumpletuhin ang trio (Amazon $25B + Microsoft $13B+ + Google $40B). Future #1 ngayon explicitly nag-predict na para sa Q3 2026, **enterprise multi-cloud LLM strategy nagshi-shift mula "multi-runtime" patungo sa "multi-frontier-vendor."**
- **Proprietary vs open-weight split (4/21)** Relevance 5: humahasa via **GPT-5.5 API +2x** vs **DeepSeek V4-Pro sa ~7x mas mura** sa parehong window; Apr 26 Bloomberg-via-CCTV piece officially nag-aalign ng DeepSeek V4 sa Huawei Ascend.
- **Agent Registry / OAuth trust / Agent Control Plane (4/19, 4/22, 4/23)** Relevance 5: lahat nagko-converge sa **Okta Showcase 2026 blueprint na may Agent Gateway bilang central MCP control plane**, Cross App Access protocol, TrueFoundry MCP Security / Zero Trust guide.
- **27B-dense + 1M-context standard (4/23)** Relevance 5: decisively ina-deliver ng **Qwen3.6-27B na nakahihigit sa 397B-A17B MoE sa SWE-bench Verified sa consumer-GPU price points** (40 tok/s sa RTX 3090 Q4_K_M ~16.8 GB).
- **Three-cloud oligopoly thesis (4/25)** Relevance 5 — keystone validation ng araw. Anthropic annual run-rate revenue lampas sa **$30B** (vs ~$9B end-2025).
- **Relevance 4**: secret-leakage via CI / agents (4/20, ikatlong agentic-IDE RCE ng Pillar); Physical-AI-as-RaaS (4/22, BMW Leipzig + Tesla Earth Day + Hannover Messe); 1M-context-default-open-weight (4/24, DeepSeek V4 + Qwen3.6-27B); MCP-protocol-attack-surface (4/25, threat + defense sa parehong window).
- **Relevance 1-2**: 1-bit native training (4/19), Headless Everything (4/20), training-vs-inference SKU split (4/22) walang direct progress ngayon. Third-party-vendor-boundary (4/23) at SaaS-displacement-valuation reset (4/24) nagre-register lamang ng weak signals — ang market action ngayon ay hardware-rally-driven (NVIDIA $5T retake / AMD +13.9% / Intel +24%) sa halip na predicted Workday / Atlassian / Box / Smartsheet 15%+ chained falls.
- User Prediction 1 (malicious local LLM → malware): **strong corroboration**. SGLang CVE-2026-5760 ay eksaktong failure mode — model file (GGUF) nagdadala ng executable code (Jinja2 SSTI sa `tokenizer.chat_template`) na nag-fi-fire sa loob ng inference server; public PoC + CERT/CC VU#915947 ay nag-weaponize. Okta Agent Gateway bilang central MCP control plane + TrueFoundry "MCP Security: Guide to Zero Trust for Agentic AI" ay nag-fo-formalize sa **"intentionally design system paths AI alone cannot access"** architecture bilang real product category.
- User Prediction 2 (cloud vs local split, SaaS price increases): **direct codified confirmation**. Future #3 ngayon explicitly: **"consumer-GPU coding agent nagpapalit sa cloud-only coding API para sa ≥30% ng dev workloads para sa Q3 2026."** GPT-5.5 API sa $5 / $30 (2x increase, na may Codex na nagba-bawas ng output tokens ~40% para "i-offset ang per-token raise via per-task cost") lumapag sa parehong linggo na DeepSeek V4-Pro shipped sa ~7x mas mura kaysa Claude Opus 4.7.
- User Prediction 3 (RL/LLM-based forecasting): walang direct case ngayon. Pinakamalapit na adjacent ay ang Anthropic engineering postmortem (quality-regression analysis, hindi forecasting-improvement piece). Carry-only.

[future-prediction-20260426.md](future-prediction/fil/future-prediction-20260426.md)

---

## 2026-04-25

### News

- **Nakuha muli ng NVIDIA ang $5.12T market cap sa Apr 24 close** — Sinindihan ng after-close beat ng Intel noong Apr 23 ang chip sector. Nag-close ang NVIDIA sa record na $208.27 (+4.3%); lumalapad ang gap sa Alphabet ng higit sa $1T. Nagdagdag ang AMD ng **+13.90% ($347.77)** sa parehong araw (May 5 print).
- **Tesla ginawang Earth Day marketing day ang Apr 25, libreng namimigay ng "Plant Cubes" na inilubo ng Optimus V3** — Sa U.S. flagship stores, kumukuha ang FSD (Supervised) demo participants ng Plant Cube na inilubo ng Optimus.
- **Google Cloud × Thinking Machines Lab: multi-billion-dollar GB300 deal (na-announce Apr 22)** — Inadopto ng TML ni Mira Murati ang Google Cloud A4X Max VMs na pinapagana ng NVIDIA **GB300**; training / serving speed **2x** ng prior generation.
- **Sinimulan ng BMW Group ang seryosong AEON humanoid trials sa Plant Leipzig mula Apr 2026 + binuksan ang Physical AI Center of Competence** — Sa rekord ng Spartanburg ng Figure 02 (**30,000 X3 vehicles sa 10 buwan / 90,000 parts / 1.2M steps / 1,250 oras**), binuksan ng BMW ang unang Physical AI hub ng Europe sa Leipzig.
- **Hannover Messe 2026 (Apr 20-24) nag-close sa Physical AI bilang first central theme** — 130,000 visitors / 4,000 exhibitors / 1,600 speakers; AEON / HMND 01 / Apptronik Apollo / Agility Digit inihaharap nang sabay-sabay.
- **OpenAI GPT-5.5 / GPT-5.5 Pro API public Apr 24** — input $5.00 / output $30.00 per M tokens (**2x increase** vs GPT-5.4); Pro sa $30 / $180. Codex bumababa ang output tokens ~40% upang mag-offset ng per-task cost.
- **DeepSeek V4 Pro detailed benchmarks** — IMOAnswerBench **89.8** (sa itaas ng Claude Opus 4.7 75.3 / Gemini 3.1-Pro 81.0, malapit sa GPT-5.4 91.4); agentic sa itaas ng Sonnet 4.5, Opus 4.5-class. Presyo: **$1.74 input / $3.48 output per M tokens (1/7 ng Opus 4.7)**, Apache 2.0, mahigpit na integration sa Huawei Ascend.
- **Claude Code v2.1.117 (Apr 25)** — `/resume` ay nag-auto-summarize ng stalled / large sessions bago mag-reload upang maiwasan ang context overflow.
- **OpenClaw v2026.4.23 (Apr 24)** — Image gen + reference-image editing via Codex OAuth sa Providers/OpenAI; gayundin via `image_generate` API sa Providers/OpenRouter.
- **AWS Bedrock AgentCore Browser nagdadagdag ng OS-level interaction (Apr 22)** — File upload / OS dialog handling / multi-window switching.
- **Salesforce Q4: Agentforce ARR $800M / 29,000 deals (+50% QoQ)** — FY2026 revenue $41.5B, Q4 EPS $3.81 / revenue $11.20B (+12.1% YoY).
- **Nginx UI CVE-2026-33032 (MCPwn, CVSS 9.8) actively exploited in the wild** — `/mcp_message` endpoint na may walang lamang IP allowlist by default ay nag-bypass ng auth middleware; 12 unauthenticated MCP tool calls naka-expose; 2 HTTP requests upang fully take over Nginx.
- **Saltcorn CVE-2026-41478 (CVSS 9.9) disclosed (Apr 24)** — Mobile-Sync SQL injection.
- **Amazon × Anthropic karagdagang $25B + 5GW Trainium2/3 capacity (detail finalized Apr 20)** — $5B immediate + $20