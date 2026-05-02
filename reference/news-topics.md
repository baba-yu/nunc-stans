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

## Default reference sites

(Search hints — not an exclusive whitelist.)

- https://arxiv.org/list/cs.AI/recent
- https://simonwillison.net/
- https://news.ycombinator.com/
- https://www.reddit.com/

The writer is **not limited** to these — wider sourcing is welcome — but they are the baseline pull.

## Citation policy reminder

Every URL added to a `Reference link(s)` cell or `## News` bullet must pass `app/skills/citation_restriction_check.py` against `reference/citation-restrictions.md`. Denylisted hosts get substituted or the bullet gets dropped; never publish a known violation.
