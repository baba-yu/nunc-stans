# 3_daily_briefing — link-routing + structural completeness checks

Inline scripts called from `3_daily_briefing` Step 3 + Step 4. Kept out of the orchestrator so it stays under 80 lines.

## Link-routing check (Step 3)

For every link in a non-English README, either the locale segment matches the README's locale OR the link is the explicit `en` fallback **and** the corresponding locale file genuinely does not exist.

```bash
fail=0
for L in ja es fil; do
  while IFS= read -r line; do
    path=$(printf '%s\n' "$line" | sed -nE 's/.*\((report|future-prediction)\/([^)]+)\).*/\1\/\2/p')
    seg=$(printf '%s\n' "$path" | awk -F/ '{print $2}')
    if [ "$seg" = "$L" ]; then continue; fi
    if [ "$seg" = "en" ]; then
      loc_path=$(printf '%s\n' "$path" | sed "s|/en/|/$L/|")
      if [ ! -f "$loc_path" ]; then continue; fi
      echo "FAIL README.$L.md links into /en/ but $loc_path exists: $line"; fail=1
    else
      echo "FAIL README.$L.md has unexpected locale segment '$seg': $line"; fail=1
    fi
  done < <(grep -E "\((report|future-prediction)/" "README.$L.md")
done
exit $fail
```

## Structural completeness check (Step 4)

This catches mid-content truncation when the writer's `max_tokens` cap fires (commit `35b7a64` shipped exactly this failure across all 4 locales). Run after the link-routing check:

```bash
python3 -m app.skills.post_write_integrity --kind readme \
  --path README.md --path README.ja.md --path README.es.md --path README.fil.md
```

The shared `post-write-integrity` skill checks per-block `### News` + `### Predictions check` presence + terminating links, file-ends-in-`---`, and the truncation tells (unclosed `[…](`, balanced `**`).

## Resume protocol on failure

Identify the last complete `## YYYY-MM-DD` block (one whose body has both `### News` and `### Predictions check` with terminating links) and re-prompt the writer:

> The previous run was truncated; continue from after the `## <last good date>` block onward, do **not** repeat content already on disk.

Splice or rewrite the file, then re-run **both** the link-routing check and the post-write-integrity skill. If the same gap recurs on the second attempt for the same locale, abort and surface the work log — the per-locale prompt exceeds the model's output cap and the README shape needs to be split (one `## YYYY-MM-DD` block per call).
