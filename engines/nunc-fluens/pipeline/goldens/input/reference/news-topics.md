# Daily-update topic coverage

Every `1_daily_update` run must search for news under each of these topics. The list is extracted from the legacy spec so it lives outside the orchestrator (which is now ≤ 80 lines).

## Coverage rules

- **Unsloth** — search **every run**. It is a constant-coverage topic (the user has explicitly flagged it).
- **Multica** — search **only when news-driven** (a hit elsewhere references it). Not a constant-coverage topic.
- All other items below — best-effort coverage; the writer's `gather-news` LLM context decides which are newsworthy that day.

## Topic list

- LLM Workflow
- Multi-profiling for Local LLM (e.g. Multica)
- Agent Harness (OpenClaw, NemoClaw, Hermes Agents, etc.)
- Platform for Local LLM (vLLM, SGLang, etc.)
- Ecosystems for Local LLM Embedded System (Foundry Local, etc.)
- Local LLM Models
- Local LLM Optimization, Fine-tuning (Unsloth — every run)
- Ecosystems for LLM on PaaS (AWS Bedrock, Azure AI Foundry, etc.)
- AI Security
  - Zero-trust based access control for agentic AI
  - Monitor and manage AI agent behavior
- CVE update on score ≥ 8.0
- Hardware
- Physical AI
- LLM-related research and papers
- Stock prices and corporate activity (frontier labs, hyperscalers, chip vendors)
- For each of the above, what is being progressed in:
  - Business plan
  - Application fields
  - Applied research
- Bay Area / SV AI meet-up events
- Other standing-out topics

## Topic scope clarifications (added 2026-05-28, expanded 2026-05-29)

> **原則:** topic 名の brand 例は「このあたり探して」の guidepost であって whitelist ではない。ニュースのパターン (security-ness / chip-ness / robot-ness / event-ness / coding-agent-ness / model-release-ness / orchestration-ness etc.) が semantic 判定の基準。具体的にどのベンダーが出したかで限定しない。来月新規参入してくるベンダーも、同じカテゴリの活動をしていれば parent topic にカウントする。
>
> このスコープ表は `compose-news-section` の検索範囲指示 + `verify-topic-coverage` 監査エージェントの rubric の両方を兼ねる。

| Topic (as written above) | Broader semantic scope |
|---|---|
| LLM Workflow | Any agent / workflow / pipeline orchestration platform. Existing examples: Mistral Workflows, n8n. Sibling brands: LangFlow, Flowise, Inngest, Restate, Temporal, Dust.tt, Activepieces, Prefect, Vellum, AutoGen Studio. Generic concepts: agent DAG, workflow builder, multi-step agent, pipeline orchestration, agent template, composable workflow. **Newly emerging workflow/orchestration tools count.** |
| Agent Harness (OpenClaw, NemoClaw, Hermes Agents, etc.) | The three OSS harnesses plus other coding agents / agentic IDEs / autonomous developer tools — Codex CLI, Claude Code, Cursor, Continue, Cline, Aider, Roo Code, Windsurf, Devin, OpenInterpreter, Copilot CLI, Q Developer, JetBrains Junie, plus the MCP-server ecosystem. The above is the 2026 active brand set; **将来新規参入する coding agent / agentic IDE / autonomous dev tool も同等にカテゴリ内**. Generic: AI coding agent, AI pair programmer, agentic IDE, autonomous developer loop. |
| Platform for Local LLM (vLLM, SGLang, etc.) | vLLM, SGLang plus other inference engines / serving stacks — TGI, TensorRT-LLM, MLC LLM, llama.cpp serving, Ollama serving, LiteLLM, RouteLLM, LMDeploy, Aphrodite engine, BentoML, Triton inference server. **新規 serving stack / inference engine が出てきても同等**. Generic: LLM inference engine, LLM serving runtime, OpenAI-compatible server, inference router, model serving framework. |
| Ecosystems for Local LLM Embedded System (Foundry Local, etc.) | Foundry Local plus any edge / on-device LLM runtime — Ollama, LM Studio, llama.cpp, MLX (Apple Silicon), Snapdragon AI Engine / Hexagon NPU, Intel OpenVINO, ROCm edge, NVIDIA TensorRT-LLM-edge, MLC LLM, llamafile, ExecuTorch, Core ML LLM, WebGPU LLM, browser LLM. **新規 edge LLM runtime / NPU SDK が出てきても同等**. Generic: on-device inference, edge LLM, embedded LLM, NPU runtime / inference, edge AI. |
| Local LLM Models | Any open-weight LLM release, new model family, model card publication, quantized release. Existing families: Qwen, Llama, Mistral, DeepSeek, MiniMax, OLMo, Phi, Gemma. Sibling families: Hermes (Nous), Yi (01.AI), Command R, Solar (Upstage), DBRX, Granite (IBM), Falcon, Stable LM, RWKV, Mamba, Aya, Smaug, OpenHermes, Dolphin. **任意の新オープン LLM ファミリーも同等にカテゴリ内**. Generic: open weight release, model card, instruction-tuned variant, Apache 2.0 release, quantization release. |
| Ecosystems for LLM on PaaS (AWS Bedrock, Azure AI Foundry, etc.) | Bedrock, Azure AI Foundry, Vertex AI plus other managed-inference / hosted-LLM platforms — OpenRouter, Together AI, Fireworks AI, Anyscale, Replicate, Lepton, Perplexity API, Cohere Compass, DeepInfra, Hyperbolic, Modal, Baseten, Runpod, Mistral La Plateforme. **新規 managed-inference / hosted LLM API が出てきても同等**. Generic: managed inference, hosted LLM API, serverless inference, frontier model API, inference-as-a-service, PaaS LLM. |
| AI Security | Any AI / agentic / LLM security news. Incumbent vendors: CrowdStrike Falcon, Microsoft Defender for Cloud, Sysdig, Akamai SkyAtlas. Emerging vendors: Lakera, Robust Intelligence, Pillar Security, Prompt Security, Lasso Security, Calypso AI, AIM Security, Knostic, HiddenLayer, Protect AI, GuardRails, Resolve AI, Salvador Tech, Mindgard, Operant AI, Astrix. **将来登場する任意の AI security ベンダーも同等にカテゴリ内**. Generic concepts: jailbreak, guardrails, red-teaming, model theft / extraction / poisoning / inversion, data exfiltration, agent hijack / takeover / breakout, tool-call abuse, supply-chain attack, RAG poisoning, prompt injection, zero-trust agent, MCP firewall, agent identity, responsible disclosure. **ベンダーリストで限定しない。security-ness のパターンで判定**. **AI-security-SoC standing watch (added 2026-06-05 per user):** actively track the AI-security × silicon intersection — secure AI accelerators, confidential-computing inference (TEE-I/O), hardware root-of-trust for AI chips, on-die security NPUs, and Axiado-style secure-control SoCs. User's thesis: a purpose-built "secure AI accelerator SoC" (high-end NPU + on-die RoT fused into one marketed part) is currently an open gap that is likely to fill — surface concrete shipping/announcement signals when they appear and let them seed a daily prediction. Overlaps the Hardware row; either topic may carry the bullet. |
| Hardware | Any AI accelerator / chip / data-center hardware. Chip vendors: NVIDIA, AMD, Intel, Groq, Cerebras, Tenstorrent, SambaNova, Rebellions, Etched, d-Matrix, Lightmatter, Esperanto Tech, MatX, Mythic, Apple M-series, Tesla Dojo, Untether AI, FuriosaAI, Hailo, RAIN AI. **新規参入する任意のチップベンダー / fabless / data-center hardware startup も同等にカテゴリ内**. Specific SKUs: H100, H200, B100, B200, B300, GB200, MI300, MI400, MI4xx, Blackwell, Rubin, Helios, CS-x, LPU-vN, SXMx. Generic concepts: AI accelerator, inference ASIC, GPU/TPU/LPU/NPU cluster, data-center capacity / build / expansion, HBM, wafer, fab, tape-out, process node. **AI-security-SoC intersection (standing watch, added 2026-06-05 per user):** also track security-focused silicon — confidential-computing accelerators (TEE / TEE-I/O for inference, e.g. NVIDIA Blackwell), hardware root-of-trust for NPUs/accelerators, secure-control SoCs with on-die AI threat detection (e.g. Axiado AX3000/AX3080), and secure-enclave LLM inference (Tinfoil / Opaque / Fortanix / Edgeless). See the AI Security row for the user's thesis. |
| Physical AI | Any robotics / embodied-AI news. Humanoid vendors: Tesla (Optimus), Apptronik (Apollo), Figure, 1X Technologies, Astribot, Agility Robotics (Digit), UBTECH, Sanctuary AI, Reflex Robotics, Kepler, Fourier Intelligence, Engineered Arts (Ameca). Quadrupeds / other: Unitree, Boston Dynamics (Atlas / Spot), Anybotics. **新規参入する任意の humanoid / robotics ベンダーも同等にカテゴリ内**. Generic concepts: bipedal / quadruped / wheeled robot, autonomous / robotic fleet, humanoid cohort / deployment / production, VLA model, vision-language-action policy, embodied AI / intelligence, physical AI, teleoperation, assembly / warehouse / factory robot, end-effector, gripper, manipulation. **カテゴリは embodied AI / physical action** であって固定ベンダーリストではない。 |
| Bay Area / SV AI meet-up events | **Forward-looking, user-attendable AI events** — the user reads this section to decide which events to RSVP / show up to, so the bullet's value is "this is still in front of you, here's how to plan for it". Vendor-hosted events (Summits / DevDays / developer days / launch events / partner conferences), conferences with AI tracks (RSA / DEF CON / Black Hat / NeurIPS / ICLR / etc.), hackathons, Bay Area meet-ups, AI Engineer Summit, GitHub Universe, re:Invent, Snowflake Summit, Cerebral Valley, Latent Space meet-ups, AI Tinkerers SF — all qualify when the event date is still in the future on the article's publication date. **Past / completed events do NOT qualify as the bullet itself** (they keep value as citation sources for other bullets and as prior-storyline context, but a single-day event that already closed today at 3 PM PT is not in scope after that close). **Do NOT restrict to a fixed vendor list** — any vendor (established or newly emerged: Zenity, Lakera, Robust Intelligence, Adversa, or whoever hosts an event next month) is in scope. First priority: Bay Area / SV (the user is local). Acceptable broader scope: AI events anywhere in the US/EU/JP that the user could practically travel to (re:Invent Vegas, Snowflake Summit SF/Vegas, AWS Summit Tokyo, NeurIPS Vancouver, etc.). The category is *forward-event-ness*, not *brand-list*. **CARRY-FORWARD EXCEPTION (events topic only):** unlike every other topic, the events bullet is allowed and expected to **repeat** still-upcoming events from the prior day's events bullet, even when there is no fresh state-change today. The user wants a stable, accumulating reference of upcoming events to plan attendance against. Each day, the writer MUST (1) read yesterday's events bullet from `app/sourcedata/<yesterday>/news_section.json` sections matching this topic, (2) drop any event whose start/end date has passed (today ≥ event end date → drop), (3) carry forward every remaining still-upcoming event verbatim or with minor consolidation, and (4) ADD any newly-discovered upcoming events on top. Yesterday's events bullet is the floor, not the ceiling. ADR-002 Rule 1 (continuation cap of 2) and Rule 2 (state-change requirement) are explicitly waived for THIS topic only. **SUB-CATEGORY SEARCH (mandatory every run — added 2026-06-05 after the events bullet skewed entirely to marquee dev conferences and dropped AI-security + AI-chip events):** the events search MUST actively and separately cover THREE sub-tracks each run, not just the big developer/data keynotes — (1) **mainstream dev/data conferences** (WWDC, Build, Google I/O, Databricks, Snowflake, AI Engineer World's Fair, GitHub Universe, re:Invent); (2) **AI-security events** — vendor-hosted (Zenity AI Agent Security Summit, Lakera, Adversa, HiddenLayer, etc.), security cons with AI tracks/villages (RSA, Black Hat AI Summit, DEF CON AI Village, OWASP Global AppSec), and AI-risk / confidential-computing summits (SecurityWeek AI Risk Summit, Confidential Computing Summit); (3) **AI-chip / hardware events** (Hot Chips, AI Infra Summit / AI Hardware & Edge AI Summit, AMD Advancing AI, NVIDIA GTC, chip-vendor launch events). The marquee dev conferences must NOT crowd out tracks 2 and 3 — surface at least the nearest still-upcoming item from each track when one exists. The user attends niche AI-security events (e.g. Zenity, which they specifically flagged) and tracks AI-chip launches; missing those is the exact failure this clause fixes. |
| Stock prices and corporate activity | Any AI-sector financial news. Subject companies are frontier labs / hyperscalers / chip vendors / AI-adjacent public + private. Publisher proper-name references stay (Goldman Sachs, Morgan Stanley, Bloomberg, Reuters) but are illustrative — other sell-side desks count (JPMorgan, BofA, Barclays, Citi, Wells Fargo, Bernstein, Jefferies, Cowen, Needham). Coverage includes index events (Russell / S&P reconstitution / rebalance), M&A, IPO filings (S-1, pricing, allocation), SEC disclosures (8-K, 10-Q), funding rounds (Series A-D, venture, growth, upround / downround), analyst actions (initiated, upgraded, downgraded, reiterated at Buy / Sell / Hold / Outperform / Underperform / Neutral / Market-Perform / Overweight / Underweight), institutional vs retail positioning. |

**How to apply:** when writing the `search_log.json` entry for a topic, if a brand name is mentioned in the topic ("Foundry Local") but the actual news today comes from a sibling brand in the broader category ("Ollama 1.0 release"), count that as `searched=true, hits=N` for the parent topic. Do NOT report `searched=false` or `hits=0` just because the named example didn't ship news that day. The `verify-topic-coverage` auditor will re-check this judgment semantically — over-strict narrow reads will be flagged as `search_log_underreports`.

## Default reference sites

(Search hints — not an exclusive whitelist.)

- https://arxiv.org/list/cs.AI/recent
- https://simonwillison.net/
- https://news.ycombinator.com/
- https://www.reddit.com/

The writer is **not limited** to these — wider sourcing is welcome — but they are the baseline pull.

## Citation policy reminder

Every URL added to a `Reference link(s)` cell or `## News` bullet must pass `app/skills/citation_restriction_check.py` against `reference/citation-restrictions.md`. Denylisted hosts get substituted or the bullet gets dropped; never publish a known violation.
