# Gwada Stats automatic updates

`.github/workflows/update-gwadastats.yml` runs daily at 10:17 UTC (06:17 in Guadeloupe), after collector changes, or through **Run workflow** in GitHub Actions. It runs on GitHub without Codex, a local computer, a paid API, or a personal access token. Scheduled starts can be delayed by GitHub.

The Python standard-library collector reads RCI's Guadeloupe news feed and recent articles for explicit annual homicide totals. Road deaths come from supported annual summaries published by the Préfecture and DEAL. It never adds individual incidents, projects deaths from a clock, or interprets an absent report as zero.

Only supported dated claims for Guadeloupe's scope are accepted. Ambiguous counts, conflicting scopes, unsupported wording and unavailable sources preserve the previous record. The page shows each report's actual cutoff. Source-format changes may require a parser repair and a new fixture test.

`gwadastats/data.json` contains the current common reference year, independent counts, cutoff and publication dates, source links and per-category `checkedAt` dates. Its `reviewedAt` is the latest successful check of either category. A failed category retains its own `checkedAt`. `update-status.json` records each attempt, last success and errors. A new year replaces the previous archive only when both categories have verified totals for the same new year.

From the repository root:

```sh
python3 -m unittest discover -s scripts/gwadastats -p 'test_*.py' -v
python3 scripts/gwadastats/update_stats.py --data gwadastats/data.json --status gwadastats/update-status.json --dry-run
node scripts/gwadastats/verify-data.mjs
```

The workflow validates the JSON, commits only the two data/status files, then explicitly requests a GitHub Pages build. This request matters: commits made using `GITHUB_TOKEN` do not trigger a Pages build by themselves. It finally checks that the public JSON matches the run and reports missing categories as a failed check. Normal git pushes and rebases preserve concurrent work; conflicts stop the run without forcing changes.

The status commit also keeps a healthy public repository active, avoiding GitHub's 60-day inactivity limit on scheduled workflows. If checks stop, inspect Actions and re-enable a disabled schedule. Every open page refetches its JSON every 15 minutes and after returning to a stale tab, preserving the last valid result during transient errors.

The water counter remains a separate estimate based on the 2023 network balance. Do not silently replace its reference year or methods during death updates. Keep the shared assets under `dlo/` and `water/`; only their index pages redirect.
