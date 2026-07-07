# Skill: backfill-reasoning-trace

Retro-extract reasoning fields (`because`, `given`, `so_that`, `landing`, `eli14`) and the `title` from legacy predictions ingested before Phase 2 landed. Reads the prediction's source `report/en/news-*.md`, extracts the relevant `## Future` numbered item via `source_row_index`, and (with an LLM in the loop) emits the 5 reasoning fields + the title.