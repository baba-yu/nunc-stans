# Citation Restrictions

Source of truth for which hosts may be cited in this project's outputs (`report/`, `future-prediction/`, `README*.md`, the dashboard). Read by the Reference Restriction Check in `design/scheduled/1_daily_update.md` § Step 8 and `design/scheduled/2_future_prediction.md` § Step 4.

This project's use case for cited sources: an AI (Anthropic's Claude) generates 1-3 sentence paraphrased summaries of articles fetched from these hosts and links back to the original. The host-side ToS clauses that matter for us are: explicit AI-training / AI-summarization prohibitions, scraping / bot prohibitions, and prohibitions on creating derivative works.

**Position on scraping:** A user-configured agent that fetches a host's pages and feeds them to an LLM to produce a published paraphrase IS scraping for the purposes of this policy. Any host whose ToS bans bots, spiders, scrapers, automated extraction, or data mining is therefore a hard-fail (`denylist`) for our use, regardless of whether their ToS spells out "AI" specifically.

**Position on parent-corp ToS:** A parent company's ToS that governs all owned properties propagates to every subdomain we cite. The `parent_groups` section below lists corporate parents whose AI/scraping prohibition we have confirmed; any cited host that is a member (or a subdomain of a member) inherits `denylist`. This closes the loophole where a parent's master ToS bans AI use but each owned brand publishes independently without restating the clause.

**Position on unconfirmed ToS:** A host whose ToS we attempted to retrieve but could not reach (404 / 403 / blocked / timed out / DNS failure) gets the `unconfirmed_denylist` treatment — safe-side. We default to NG until a human can re-pull the ToS and reclassify. This is stricter than the historical `paywall_short_quote_only` posture (which assumed paraphrase was OK without the clause); the project's ML-summarization use case has too much exposure to leave unconfirmed sources in a "caution-but-allow" state.

This is the **English-only canonical document**. Scheduled tasks read this file directly and operate in English; locale fan-outs do not depend on it.


## How the buckets work

- **`denylist`** — A match is a hard-fail. The Reference Restriction Check exits non-zero, and the citation must not ship. Substitute another source for the same factual claim, or drop the bullet/row.
- **`parent_groups`** — Hard-fail by inheritance. Any cited host that exact-matches OR is a subdomain (suffix-matched on dot boundary) of a listed member inherits `denylist`. Resolution order: explicit `denylist` first, then `parent_groups`, then `unconfirmed_denylist`.
- **`unconfirmed_denylist`** — Hard-fail (safe-side). The host's ToS was unreachable / blocked / timed out at the most recent survey. Stays here until a human retrieves the ToS and either keeps the host on `denylist` (if AI/scraping clause confirmed) or moves it to `paywall_short_quote_only` / `requires_attribution` / removes it (default-allow).
- **`paywall_short_quote_only`** — Linking is allowed; **no verbatim quote longer than ~25 words** from these sources may appear in our output. Used only for hosts where we have positively confirmed ToS does NOT ban scraping/AI but DOES restrict derivative reuse. Our writer paraphrases by default, so this is usually a no-op — but it matters for `2_future_prediction.md`'s "Checking Predictions Against Reality" rows, which sometimes lift a phrase verbatim as evidence (see "Quote eligibility" below).
- **`requires_attribution`** — Outlet name must appear adjacent to the link. Our standard `[Outlet - Title](url)` link format already satisfies this; the list is a reminder for human reviewers, not a runtime gate.

**Quote eligibility for `## Checking Predictions Against Reality` (Task 2).** Verbatim quotes used as evidence in the validation table are only permitted from hosts that are NOT in any restrictive bucket. For hosts in `paywall_short_quote_only`, the evidence cell must paraphrase. For hosts in `denylist` / `parent_groups` / `unconfirmed_denylist`, the citation cannot appear at all.

**Default-allow policy.** Hosts not listed below are allowed by default. The Reference Restriction Check appends new sightings to `reference/citation-policy-review.md` so a human reviewer can decide whether each unclassified host needs classification.


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


## parent_groups

Parent corporations whose master ToS prohibits AI training / scraping / data-mining / derivative reuse. Any cited host that is exact-match OR a subdomain of a listed member inherits `denylist` automatically — no need to enumerate every subdomain.

Format: each parent gets a `### <Parent Name>` sub-header followed by a bullet list of owned domains. Members are matched on dot boundary (`foo.cnbc.com` matches member `cnbc.com`; `notcnbc.com` does not).

### NBCUniversal

NBCUniversal Prohibited Actions §K bans use of Content "to directly or indirectly train any AI tool, model, system or platform." Governs every NBCUniversal property.
Source: https://www.nbcuniversal.com/terms/prohibited-actions

- nbcnews.com
- msnbc.com
- today.com
- nbcsports.com
- syfy.com
- bravotv.com
- usanetwork.com
- peacocktv.com
- universalpictures.com
- cnbc.com

### Yahoo

Yahoo ToS bans automated data collection and creating derivative works based on Content.
Source: https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html

- yahoo.com
- finance.yahoo.com
- news.yahoo.com
- sports.yahoo.com
- aol.com
- techcrunch.com
- engadget.com

### Future plc

Future plc ToS bans "spidering, screen-scraping, database-scraping" and "any automatic means of obtaining information."
Source: https://www.futureplc.com/terms-conditions/

- tomshardware.com
- techradar.com
- pcgamer.com
- livescience.com
- space.com
- tomsguide.com
- ign.com
- gamesradar.com
- creativebloq.com
- t3.com

### Paramount Global

Paramount ToS bans scraping, data-mining, and creation of any derivative works "even if free of charge."
Source: https://legal.paramount.com/us/en/cbsi/terms-of-use

- cbsnews.com
- cbssports.com
- paramountplus.com
- mtv.com
- comedycentral.com
- nick.com
- showtime.com
- pluto.tv

### Conde Nast

Conde Nast Master User Agreement bars systematic copying / data-mining / use to train AI without paid license.
Source: https://www.condenast.com/user-agreement

- wired.com
- arstechnica.com
- newyorker.com
- vanityfair.com
- vogue.com
- gq.com
- bonappetit.com
- pitchfork.com
- self.com
- architecturaldigest.com

### Vox Media

Vox Media has a 2024 OpenAI licensing deal confirming AI use of its content requires a paid license; ToS bars scraping / data-mining / derivative reuse.
Source: https://www.cdpinstitute.org/news/openai-strikes-deals-with-vox-media-and-the-atlantic/

- theverge.com
- vox.com
- polygon.com
- eater.com
- sbnation.com
- theringer.com
- nymag.com
- vulture.com
- thecut.com
- curbed.com

### Warner Bros. Discovery

WBD is actively suing AI firms (Midjourney case 2024); CNN's commercial ToS bars derivative reuse.
Source: https://commercial.cnn.com/terms-of-use/

- cnn.com
- hbo.com
- max.com
- discovery.com
- foodnetwork.com
- hgtv.com
- tlc.com
- animalplanet.com

### Bloomberg L.P.

Bloomberg ToS §3 bans scraping, bots, and data-mining; "may not be used to construct a database of any kind." Plaintiff in active AI-training copyright litigation.
Source: https://www.bloomberg.com/notices/tos/

- bloomberg.com
- news.bloomberglaw.com
- bna.com


## unconfirmed_denylist

ToS could not be retrieved at the most recent survey (404 / 403 / blocked / timed out / DNS failure / parser hit anti-bot wall). Project policy: unconfirmed → safe-side denylist. A human reviewer should re-fetch the ToS and either keep the host here (if AI/scraping clause confirmed), promote to explicit `denylist`, demote to `paywall_short_quote_only` or `requires_attribution`, or remove (default-allow).

| Host | Verdict basis | Source |
|---|---|---|
| theregister.com | ToS landing page was unreachable at survey time; editorially anti-scraping. Treat as hard-fail until clause is retrieved. | https://www.theregister.com/Profile/contact/ |
| theguardian.com | ToS page returned blocked at survey time. The Guardian publicly opposes unlicensed AI training and has signed publisher-coalition letters; treat as hard-fail. | https://www.theguardian.com/help/terms-of-service |
| npr.org | ToS page timed out at survey time. NPR has not published an AI-specific clause but is editorially aligned with publisher AI-licensing coalitions. | https://www.npr.org/about-npr/179876898/terms-of-use |
| inc.com | ToS fetcher returned 403 at survey time. No AI clause confirmed but reuse posture unconfirmed. | https://www.inc.com/terms-of-service.html |


## paywall_short_quote_only

Hosts where we have positively confirmed the ToS does NOT ban scraping or AI training, but DOES broadly restrict reuse / derivative works. Linking is allowed; no verbatim quote longer than ~25 words.

(currently empty — historical entries here that turned out to be ToS-unreachable have been migrated to `unconfirmed_denylist` per the safe-side policy)


## requires_attribution

Reminder list only — runtime check does not gate on this. Our standard `[Outlet - Title](url)` link format already satisfies adjacent-attribution requirements.

(currently empty)


## Maintenance

- The Reference Restriction Check appends every UNCLASSIFIED host (no bucket match) to `reference/citation-policy-review.md` with a citation count + first/last sighted dates. A human periodically reviews that ledger and either promotes the host into one of the buckets above, leaves it under default-allow, or — if the host's ToS is unreachable — moves it to `unconfirmed_denylist`.
- When a host's ToS changes (especially adding an AI clause), update its row's Verdict basis + Source columns and bump the date in the commit message.
- When a parent corporation acquires another media brand or a new corporate parent's ToS becomes relevant, add a new `### <Parent>` block under `parent_groups` and list the owned domains. Subdomain enumeration is not required — the suffix matcher handles `*.parent-domain.com` automatically.
- Hosts that are non-issues (vendor blogs, government pages, dev/community sites, press release wires) should NOT be added to any list — the default-allow policy covers them.
