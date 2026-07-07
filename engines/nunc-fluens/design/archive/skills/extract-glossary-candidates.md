# Skill: extract-glossary-candidates

Scan the day's `report/en/news-YYYYMMDD.md` for proper nouns / acronyms / technical terms that aren't already in `glossary_terms`. Add new rows with `status='candidate'` and bump per-day occurrence counts.