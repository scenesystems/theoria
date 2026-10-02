# Performance reference archive

This branch (`archive/pr117-performance`) preserves the performance investigation that followed PR #117. It is reference material for the Effect v4 migration plan (`theoria/post-118-plan.md` on `main`), not a merge candidate.

- Source head: `bfa7fa569c4ffb3310c2f46840fd84ee95ad0a2c` (tag `archive/pr117-performance-bfa7fa56`), 48 commits beyond the PR #117 head `e206de80a6a8a41485e62e921707f0f180a6bd40` (`refactor/integration`).
- `integration-split-closure-history.md`: the working closure checklist with per-phase evidence, as of `bfa7fa56`.
- `integration-split-closure-matrix.json`: the machine-readable closure matrix with workloads, medians, checksums, and dispositions, as of `bfa7fa56`.

Evidence in these files names the revision it tested and was recorded before the integration-only baseline (PR #118) merged. Treat it as historical claims to re-verify on Effect v4, not as current verification. Commit disposition (retain, rework, defer, drop) is decided in the migration plan.
