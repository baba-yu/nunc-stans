# Citation Restrictions

Source of truth for which hosts may be cited in this project's outputs (`report/`, `future-prediction/`, `README*.md`, the dashboard). Read by the Reference Restriction Check in `design/scheduled/1_daily_update.md` § Step 6.5 and `design/scheduled/2_future_prediction.md` § Step 8.5.

This project's use case for cited sources: an AI (Anthropic's Claude) generates 1-3 sentence paraphrased summaries of articles fetched from these hosts and links back to the original. The host-side ToS clauses that matter for us are: explicit AI-training / AI-summarization prohibitions, scraping / bot prohibitions, and prohibitions on creating derivative works.

**Position on scraping:** A user-configured agent that fetches a host's pages and feeds them to an LLM to produce a published paraphrase IS scraping for the purposes of this policy. Any host whose ToS bans bots, spiders, scrapers, automated extraction, or data mining is therefore a hard-fail (`denylist`) for our use, regardless of whether their ToS spells out "AI" specifically.

This is the **English-only canonical document**. Scheduled tasks read this file directly and operate in English; locale fan-outs do not depend on it.


## How the buckets work

- **`denylist`** — A match is a hard-fail. The Reference Restriction Check exits non-zero, and the citation must not ship. Substitute another source for the same factual claim, or drop the bullet/row.
- **`paywall_short_quote_only`** — Linking is allowed; **no verbatim quote longer than ~25 words** from these sources may appear in our output. Our writer paraphrases by default, so this is usually a no-op — but it matters for `2_future_prediction.md`'s "Checking Predictions Against Reality" rows, which sometimes lift a phrase verbatim as evidence (see "Quote eligibility" below).
- **`requires_attribution`** — Outlet name must appear adjacent to the link. Our standard `[Outlet - Title](url)` link format already satisfies this; the list is a reminder for human reviewers, not a runtime gate.

**Quote eligibility for `## Checking Predictions Against Reality` (Task 2).** Verbatim quotes used as evidence in the validation table are only permitted from hosts that are **NOT** in `denylist` AND **NOT** in `paywall_short_quote_only`. For hosts in `paywall_short_quote_only`, the evidence cell must paraphrase. For hosts in `denylist`, the citation cannot appear at all.

**Default-allow policy.** Hosts not listed below are allowed by default. The Reference Restriction Check should surface unknown hosts in its output so a human reviewer can decide whether they need classification.


## denylist

Hosts whose ToS explicitly prohibits AI summarization, scraping, automated access, bot extraction, or data mining — OR whose parent is actively litigating against AI use of their content. Verdicts and basis below; a match here is a hard-fail.

| Host | Verdict basis | Source |
|---|---|---|
| cnbc.com | NBCUniversal Prohibited Actions §K bans use of Content "to directly or indirectly train any AI tool, model, system or platform." Governs all CNBC content. | https://www.nbcuniversal.com/terms/prohibited-actions |
| bloomberg.com | ToS §3 bans scraping, bots, and data-mining; "may not be used to construct a database of any kind." Bloomberg L.P. is also a plaintiff in active AI-training copyright litigation. | https://www.bloomberg.com/notices/tos/ |
| news.bloomberglaw.com | Same parent (Bloomberg L.P.); same ToS posture as bloomberg.com plus the same active litigation. | https://www.bloomberg.com/notices/tos/ |
| technologyreview.com | Explicit clause: "Any use of the Content to create, train, enhance any machine learning or artificial intelligence is prohibited without prior written consent of MIT Technology Review." | https://www.technologyreview.com/terms-of-service/ |
| aljazeera.com | Terms §6 explicitly bans "text or data mining, or web scraping" and use of "any automated technology to analyse any portion of the Service for identifying trends, correlations or patterns." | https://www.aljazeera.com/terms-and-conditions/ |
| axios.com | ToS: "you must not use the Services or Content for development of any software program, including training a machine learning or artificial intelligence (AI) system unless you have entered into a licensing agreement with Axios." | https://legal.axios.com/terms-of-use |
| x.com | 2026-01-15 ToS update + developer agreement: "may not use the Services or Content to create, train, or improve any artificial intelligence or machine learning models without X's express written permission." | https://www.socialmediatoday.com/news/x-formerly-twitter-updates-terms-service/730223/ |
| foxnews.com | ToS §4: bans copying, data-mining, scraping, or extraction of Content "for the purpose of training any artificial intelligence algorithm, system, model or tool or any large language or machine learning model." | https://www.foxnews.com/terms-of-use |
| techcrunch.com | ToS bans "robots, spiders, scrapers, or other automated means" extracting, copying, or distributing Content; broadly forbids creating derivative works. Per project policy, scraping bans → denylist. Owned by Yahoo (RSL pay-to-crawl backer). | https://techcrunch.com/terms-of-service/ |
| finance.yahoo.com | Yahoo ToS bans automated data collection and creating derivative works based on Content. Per project policy, automated-collection bans → denylist. | https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html |
| seekingalpha.com | ToS bans robots, spiders, scrapers, and "create derivative works or otherwise exploit Content." Per project policy, scraping bans → denylist. | https://about.seekingalpha.com/terms |
| fortune.com | ToS bans "spidering, screen scraping, database scraping" and any "automatic means of obtaining information." Per project policy, scraping bans → denylist. | https://fortune.com/terms-and-conditions/ |
| cbsnews.com | Paramount ToS bans scraping and data-mining and bars creation of any derivative works "even if free of charge." Per project policy, scraping bans → denylist. | https://legal.paramount.com/us/en/cbsi/terms-of-use |


## paywall_short_quote_only

Hosts where linking is allowed but the ToS broadly restricts reuse / derivative works without a confirmed scraping or AI-specific clause we can point to, AND where verbatim quoting risks invoking the broader reuse clause. Paraphrase only — no quote >25 words.

| Host | Verdict basis | Source |
|---|---|---|
| theregister.com | ToS landing page was unreachable at the time of survey; editorially anti-scraping. Treat as caution until clause is retrieved. | https://www.theregister.com/Profile/contact/ |
| theguardian.com | ToS page returned blocked at survey time. The Guardian publicly opposes unlicensed AI training and has signed publisher-coalition letters; treat as caution. | https://www.theguardian.com/help/terms-of-service |
| cnn.com | ToS page was unreachable at survey time. Parent (Warner Bros. Discovery) is actively suing AI firms (Midjourney). | https://commercial.cnn.com/terms-of-use/ |
| npr.org | ToS page timed out at survey time. NPR has not published an AI-specific clause but is editorially aligned with publisher AI-licensing coalitions. | https://www.npr.org/about-npr/179876898/terms-of-use |
| theverge.com | ToS page unreachable. Vox Media has a 2024 OpenAI licensing deal, indicating that AI use of its content requires a paid license. | https://www.cdpinstitute.org/news/openai-strikes-deals-with-vox-media-and-the-atlantic/ |
| arstechnica.com | ToS page blocked at survey time. Conde Nast has a 2024 OpenAI licensing deal and has litigated against Cohere; restrictive stance assumed. | https://www.cdpinstitute.org/news/openai-strikes-deals-with-vox-media-and-the-atlantic/ |
| inc.com | ToS fetcher returned 403 at survey time. No AI clause confirmed. | https://www.inc.com/terms-of-service.html |


## requires_attribution

Reminder list only — runtime check does not gate on this. Our standard `[Outlet - Title](url)` link format already satisfies adjacent-attribution requirements.

(currently empty)


## Maintenance

- When a citation introduces a new host not on any list, the Reference Restriction Check should print the new host so a human can read the host's ToS and add it here (with basis) if it qualifies as `denylist` or `paywall_short_quote_only`.
- When a host's ToS changes (especially adding an AI clause), update its row's Verdict basis + Source columns and bump the date in the commit message.
- Hosts that are non-issues (vendor blogs, government pages, dev/community sites, press release wires) should NOT be added to any list — the default-allow policy covers them.
