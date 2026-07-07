# Skill: bindfs-safe-commit-push

`git add -A` + `git commit` + `git push`, working around the bindfs unlink-block. Shared by `3_daily_briefing`, `4_weekly_memory`, `5_weekly_theme_review`.

## Why this is its own skill

The whole "redirect git to a `/tmp` mirror, then rsync new objects + updated refs back to bindfs `.git`" dance is identical across the 3 tasks that push. Each previously inlined ~80 lines of bash. Skill extraction means a fix to the rsync flags lands in one place.

## Inputs

| Name | Source | Required |
|---|---|---|
| `commit-message` | full commit message body (heredoc supplied by orchestrator) | yes |
| `paths-to-add` | space-separated paths to `git add` (default: empty → `git add -A`) | optional |

## Behavior

1. Detect bindfs on the working tree (`mount` grep for `fuse.bindfs`). When detected, build a `/tmp` mirror of `.git`, set `GIT_DIR` + `GIT_WORK_TREE` env vars to redirect git there. Otherwise, run plain git.
2. `git add -A` (or the explicit path list if provided).
3. If `git diff --cached --quiet` returns 0 (nothing staged), skip commit but still push (so an earlier-step's commit gets flushed).
4. Otherwise, `git commit -m "<commit-message>"`.
5. `git push` (current branch, default upstream).
6. If running on bindfs, mirror new objects (`rsync -a --ignore-existing`) and refs (`rsync -a --inplace`) back to `.git`. **No `--delete`** — bindfs blocks unlink, and stale ghosts are inert under this flow.
7. Quarantine working-tree `*.tmp` ghosts under `.bindfs-trash/` (Windows-side cleanup required for physical purge).

## Outputs

Stdout: status line per step (`[git] /tmp gitdir mirror: <path>`, `[git] mirrored /tmp gitdir back …`, `[bindfs] quarantined N .tmp ghost(s) …`). Exit 0 on success, non-zero if `git push` fails.

## Failure modes

| Failure | Behavior |
|---|---|
| `git push` fails (auth / non-FF) | Exit non-zero; orchestrator surfaces the work log. Do **not** `--force`. |
| `cp -a .git $TMPGIT` fails | Exit 2; bindfs is in a degraded state, escalate to a human. |
| `rsync` mirror-back fails | Push already succeeded — log the failure but exit 0; the next session will re-mirror on the host side. |

## Reference invocation

```bash
# Used inside an orchestrator step:
bash -c "$(cat <<'OUTER'
  source design/skills/bindfs-safe-commit-push.sh
  bindfs_safe_commit_push "$(date +%Y-%m-%d)"
OUTER
)"
```

The implementation is in `design/skills/bindfs-safe-commit-push.sh` — pure bash, sourced by the orchestrator. PowerShell host-side runs (Windows native) bypass this skill entirely (plain `git` works there because bindfs is not in the path).
