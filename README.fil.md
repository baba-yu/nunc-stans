# news

*Available in: [English](README.md) | [日本語](README.ja.md) | [Español](README.es.md)*

Future predictions news + dashboard.

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — future-prediction dashboard
- `report/` — daily news reports
- `future-prediction/` — daily check ng kahapong news Future column laban sa ngayon

---

## 2026-04-26

### Balita

- **Ni-retract ang Claude Code v2.1.120 noong Apr 25 dahil sa startup crash sa `--resume` / `--continue`; pinipilit ng auto-update na bumalik sa v2.1.119** — `g9H is not a function` error, bundled na Antigravity binary tumitigil sa exit code 1. **8 regressions na sabay-sabay** sa Apr 24-25 (sirang auto-update, silent model swap, UI duplication, frozen WSL2 `/mcp`, na-ignore na `CLAUDE.md`, sandbox.excludedCommands, macOS worktree hang, dalawang `--resume` crashes). Nagsama-sama ang community sa `claude install 2.1.117` bilang manual downgrade.
- **OpenClaw v2026.4.24 (inilabas Apr 25) — Real-time voice calls para sa lahat ng agent + Google Meet bundle + DeepSeek V4 Flash/Pro by default** — Chrome/Twilio realtime sessions, Google Meet agent participation, DeepSeek V4 Flash bilang onboarding default, browser automation na may coordinate clicks / multi-window switching / per-profile headless override, malalim na fixes sa Telegram / Slack / MCP / sessions / TTS.
- **Ang launch ng DeepSeek V4 ay naging "full-stack" sa Apr 24-25 — SGLang + Miles Day-0 inference + RL training + V4-Pro API 75% off (hanggang May 5)** — Sinindihan ng LMSYS / Radixark ang SGLang gamit ang **ShadowRadix prefix cache / HiSparse / MTP / Flash Compressor / Lightning TopK**, at naghahatid ang Miles ng Day-0 verified RL na may **Step-0 train-inference diff 0.02-0.03 / Tilelang FP8/BF16 / Hopper/Blackwell/Grace Blackwell parallelism**. **V4-Pro API sa 75% off ay nagiging ~28x mas mura kaysa Claude Opus 4.7**.
- **Bloomberg (Apr 26): ang totoong dahilan ng pagkakadelay ng DeepSeek V4 ay "isang strategic shift sa Huawei Ascend integration"** — Iniulat ng CCTV-affiliated outlet "Yuyuantantian." Ang launch ng V4 na orihinal na para sa February-March ay na-delay dahil **"ginugol ng DeepSeek ang ilang buwan na nag-optimize ng software stack para sa Huawei Ascend chips."**
- **Nag-add ang CISA ng 4 sa KEV noong Apr 24 + Federal remediation deadline May 8** — CVE-2024-7399 (Samsung MagicINFO 9 Path Traversal, CVSS 8.8), CVE-2024-57726 (SimpleHelp Missing Authorization, CVSS 9.9), CVE-2024-57728 (SimpleHelp Path Traversal, CVSS 7.2), CVE-2025-29635 (D-Link DIR-823X Command Injection) — lahat "actively exploited in the wild."
- **Anthropic MCP Design Vulnerability (OX Security disclosure) — 200,000-server RCE risk, design-level defect** — Defekto sa STDIO interface ng MCP SDK na nagpapahintulot ng "config → command execution" nang direkta. Naa-affect ang Python / TypeScript / Java / Rust implementations, may repercussion sa 150M downloads. **Ipinagpalit ng Anthropic ang CVE bilang "expected behavior";** nag-iisyu ang researchers ng 10+ individual-package CVEs.
- **Comment and Control attack (Claude Code / Gemini CLI / GitHub Copilot Agent)** — Hidden HTML-comment payloads sa PR titles / Issue comments na sabay-sabay na hina-hijack ang lahat ng tatlong vendors' parts at nagnanakaw ng CI secrets. Bounty Anthropic CVSS 9.4 ($100) / Google ($1,337) / GitHub ($500). **Tahimik na nag-patch ang 3 vendors at walang naka-assign na CVE.**
- **LMDeploy CVE-2026-33626 (CVSS 7.5, SSRF) real-world attack na-detect 12h31m pagkalipas ng disclosure** — Pinapayagan ng SSRF sa `load_image()` ang AWS IMDS / Redis / MySQL port scanning. Lumiit ang "publish → exploit" gap patungo sa **12-hour zone**.
- **Vercel / Context.ai supply-chain breach** — Lumma Stealer → empleado ng Context.ai → empleado ng Vercel OAuth Allow All → Google Workspace takeover → env-var enumeration → benta ng $2M. Unang malaking kaso ng OAuth supply-chain breach sa AI tool.
- **Nag-close ang Hannover Messe 2026 sa Physical AI bilang first central theme (Apr 20-24)** — 100+ partners kasama ang Siemens / Foxconn / FANUC / KUKA / Universal Robots, na may AEON / HMND 01 / Apptronik Apollo / Agility Digit / Figure 02 inihaharap nang sabay-sabay. Idine-deklara ng Manila Times ang **$4 trilyon market / mass adoption phase**.
- **Tesla Earth Day (Apr 25) + Optimus Plant Cube limited giveaway + Optimus Earth Day Tee on sale** — Sa Tesla flagship stores sa U.S., kumukuha ang FSD (Supervised) demo participants ng **Plant Cube** na inilubo ng Optimus, na may **Optimus Earth Day Tee ($40)** sa online shop.
- **Big Tech Earnings Super Week ahead (sa katapusan ng linggo Apr 26) — MSFT / GOOGL / META / AMZN sa Apr 29, AAPL sa Apr 30** — Inaasahan ng Microsoft Azure +28% YoY, Alphabet capex FY26 $175-185B, Meta capex FY26 $115-135B / FY27 $142B consensus.
- **Microsoft IKE Service Extensions CVE-2026-33824 (CVSS 9.8, RCE)** — Defekto na double free ng IKEv2 (CWE-415); maaaring mag-RCE ang isang unauthenticated remote attacker via UDP 500/4500. Naayos sa 4/14, pero patuloy na lumalaki ang exploitation attempts laban sa unpatched envs.
- **llama.cpp build b8936 (Apr 26 03:28 UTC) — AVX2 Q6_K optimization** — Lumapag sa main ang `ggml-cpu: optimize avx2 q6_k (#22345)`; full multi-platform binaries inihatid.
- **Simon Willison `GPT-5.5 prompting guide` + `WHY ARE YOU LIKE THIS` + Romain Huet quote (Apr 25)** — Pagkatapos ng official prompting guide ng OpenAI, nagsisimula ang community verification phase ng GPT-5.5.

[news-20260426.md](report/fil/news-20260426.md)

### Validation

- 18 predictions na-validate sa nakalipas na linggo. Patuloy na **Relevance 5** validation sa 8 axes: **MCP-protocol attack surface / OAuth trust / Physical AI SaaS-ization / 1M-context open-weight standard / proprietary × open split / indirect prompt injection bilang primary CVE / Agent Control Plane / CI Secret leak**.
- **MCP / AI integration-layer structural vulnerabilities exposed simultaneously**: Anthropic MCP Design Vulnerability + Comment and Control attack + LMDeploy SSRF, tatlong sunud-sunod. Future #3 ngayon: **"OWASP LLM Top 10 v2026 itinaas ang Supply Chain Compromise via AI Integration sa #1."**
- **OAuth trust + Agent Control Plane**: nire-reconstruct na Vercel / Context.ai supply-chain breach (Lumma Stealer → OAuth Allow All → $2M sale) + countdown sa Apr 30 GA ng Okta for AI Agents + cierre ng Google Cloud Next '26 sa Gemini Enterprise Agent Platform sa central (260 announcements) + AWS Bedrock AgentCore CLI / Skills staged rollout.
- **Physical AI SaaS / RaaS-ization + 8h production runs = procurement requirement**: Hannover Messe 2026 Physical AI bilang first central theme, Manila Times $4 trilyon market / mass adoption phase, Tesla Optimus Plant Cube giveaway na nakakaabot ng "user-physical-handoff" phase, Agile ONE's shoe-production-line live system.
- **Proprietary × open split + hyperscaler exclusive alliance**: Bloomberg Apr 26 ay ginagawa ang **"DeepSeek V4 delay = strategic shift patungo sa Huawei Ascend integration"** opisyal na visible; lumalabas ang **4-pole scenario** (US 3 vs China Huawei Ascend); DeepSeek V4-Pro API 75% off ay 28x mas mura kaysa Claude Opus 4.7.
- **1M context bilang default**: DeepSeek V4-Pro / V4-Flash parehong sa Hybrid Attention + 1M context; SGLang + Miles' Day-0 verified RL ay nakakapag-realize ng "inferensya + RL training ng 1M-context frontier model na tumatakbo sa launch day."
- **Relevance 1-3**: Headless Everything (4/20-3, Relevance 2 — OpenClaw per-profile headless override isang hakbang pasulong, pero full-agent voice / Meet participation gumagalaw sa kabaligtaran); 1-bit native learning (4/19-1, Relevance 2 — patuloy na intro lamang ng Bonsai-8B); SKU split (4/22-1, Relevance 2 — manipis sa hyperscaler in-house chip side); local > cloud inversion (4/20-1, Relevance 3 — DeepSeek V4-Pro 75% off counter-pressure).
- User Prediction 1 (malicious local LLM → malware): Anthropic MCP Design Vulnerability (design defect, CVE denial) + Comment and Control (3-vendor silent patch + walang CVE disables behavior monitoring) + Vercel / Context.ai chain + LMDeploy SSRF na simultaneously naka-expose. Strongly underwrites ang user prediction's **"zero-trust + AI-only-inaccessible-path design,"** na may Okta for AI Agents Apr 30 GA + Microsoft ZT4AI nagko-consolidate ng market response.
- User Prediction 2 (cloud vs local split, SaaS price increases): **mixed state ng kabaligtaran at alignment** — DeepSeek V4-Pro API 75% off (28x mas mura) crashes ang cloud side; ginagawa ng OpenClaw ang V4 Flash bilang onboarding default. Sa kabilang banda, sticky ang Big Tech capex (MSFT FY26 $146B / GOOGL $175-185B / META $115-135B) + Chinese LLM × Huawei Ascend geopolitical split nag-pre-preserve ng long-term structure.
- User Prediction 3 (RL/LLM-based prediction improvement): walang direct case ngayon. Nagde-democratize ang SGLang + Miles' Day-0 verified RL ng RL training infrastructure.

[future-prediction-20260426.md](future-prediction/fil/future-prediction-20260426.md)

---

## 2026-04-25

### Balita

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
- **Amazon × Anthropic karagdagang $25B + 5GW Trainium2/3 capacity (detail finalized Apr 20)** — $5B immediate + $20B milestone-tied.
- **AI Tinkerers SF + AI Dev 26 x SF + Sage Future sa sunud-sunod (Apr 28-30)**.

[news-20260425.md](report/en/news-20260425.md)

### Validation

- 17 predictions na-validate sa nakalipas na linggo. Patuloy na **Relevance 5** validation sa 6 axes: **Agent Control Plane / OAuth trust / Physical AI SaaS-ization / 1M-context open-weight standard / hyperscaler × frontier-lab exclusive alliance / proprietary × open split**.
- Higit pang detalye sa [future-prediction-20260425.md](future-prediction/en/future-prediction-20260425.md). Para sa kumpletong daily summaries sa Filipino, malapit nang sumusunod.

---

## 2026-04-24

DeepSeek V4 Preview launch (V4-Pro 1.6T MoE / V4-Flash 284B), OpenAI GPT-5.5 launch, Intel Q1 2026 +20% blowout, Anthropic Claude Code quality post-mortem + usage-cap reset, Siemens × Humanoid HMND 01 Alpha 8-hour autonomous operation sa Erlangen factory, formation ng Agentic AI Security solution-provider axis (Okta for AI Agents / Keycard / Cisco / Microsoft + Exabeam / Zenity / Arize / Braintrust / atbp.), Tencent Hunyuan Hy3 Preview open-sourced, ServiceNow -18% post-print.

[news-20260424.md](report/en/news-20260424.md)

---
