# Nunc Fluens (news) in the monorepo

> **Phase C in progress:** the TS pipeline is being built under
> `pipeline/` (plan: `design/development/2026-07-05-phase-c-plan.md`).
> The news checkout is designated via `just news-link <dir>` (config
> `news_repo`, env override `NS_NEWS_REPO`); `analytics.sqlite` now
> lives at `<data store>/world/analytics.sqlite` (`just news-migrate-db`
> copies it there, verified; the upstream copy remains until the
> scheduler cutover). This document is rewritten when the split of the
> upstream repo into a data+publish remnant completes.

News owns the `world` scope: world prediction, observation, and external
context (constitution §6.1). This directory is the News **pipeline code**,
consolidated into the nunc-stans monorepo. The News **data** is deliberately
not here.

## Code here, data external

The upstream `~/news` repository is a live, data-heavy repo (~960 MB, mostly
generated graph snapshots under `docs/data/` and `memory/snapshots/`, plus
multilingual reports and predictions). Committing that into the monorepo
would bloat the monorepo and duplicate the world source of truth — and the
constitution treats News data as "a rebuildable cache," with News keeping the
world SoR in its own repository.

So only the pipeline code was imported (via `git filter-repo` to the code
paths, then `git subtree add`): `app/{src,skills,tests,templates,migrations}`,
`reference/`, `docs/{index.html,assets}`, and the READMEs — about 1.7 MB. The
data paths (`docs/data`, `memory`, `app/sourcedata`, `future-prediction`,
`report`, `references.txt`) are excluded and `.gitignore`d so a pipeline run
here can never commit them back.

**The world source of truth remains `~/news`.** It has its own remote and runs
the daily pipeline. Pre-v1 Phase 3 ("News view integration") is where
News's `export.py` output is retargeted from GitHub Pages to local serving and
a read-only world view is added to the ME screen (with `informed_by` edges
auto-attached on "create a commitment from this headline"). Until then,
`engines/nunc-fluens` is the code frame only; it is not wired into `just up`.

## Re-syncing the code

The upstream code evolves. To refresh `engines/nunc-fluens` from `~/news`:

```sh
git clone --single-branch --branch dev --no-local ~/news /tmp/news-code
cd /tmp/news-code
uvx git-filter-repo --force \
  --path app/src --path app/skills --path app/tests --path app/templates \
  --path app/migrations --path app/README.md --path app/pyproject.toml \
  --path app/update_pages.sh --path app/update_pages.bat \
  --path reference/ --path docs/index.html --path docs/assets \
  --path README.md --path README.ja.md --path README.es.md --path README.fil.md
cd ~/nunc-stans
git subtree pull --prefix=engines/nunc-fluens /tmp/news-code dev
```

`git filter-repo` is deterministic, so the filtered history's commit ids are
stable across refreshes and the subtree pull fast-forwards.
