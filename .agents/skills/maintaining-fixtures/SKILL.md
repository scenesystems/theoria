---
name: maintaining-fixtures
description: Updates and verifies Theoria's numerical and cryptographic reference fixtures. Use when changing golden data, conformance corpora, provenance, or fixture generators.
---

# Maintaining reference fixtures

Read the affected package's `package.json` and provenance documentation first.
Run its scripts from that package directory; do not assume all packages share a
generator or the same meaning of `fixtures:verify`.

| Package       | Source of truth                                                                                | Checks/workflow                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| effect-math   | `scripts/generate-scipy-fixtures.ts`, `scripts/fixtures/`, `test/helpers/fixtures/schemas.ts`  | `fixtures:generate`, then `fixtures:check` and affected parity tests                      |
| effect-search | `scripts/generate-optuna-fixtures.py`, `scripts/fixtures/`, `test/helpers/fixtures/schemas.ts` | `fixtures:generate`, `fixtures:check`, `fixtures:verify`                                  |
| digest        | `scripts/fixtures.ts`, `test/fixtures/external/sources.manifest.json`                          | `fixtures:check`, `fixtures:verify`; `fixtures:stamp` only after reviewing corpus changes |
| sign          | `test/fixtures/` provenance documents and `scripts/` generators                                | Follow the corpus-specific workflow, then `fixtures:check` and affected conformance tests |

- Python reference computations use `uv run` and pinned PEP 723 dependencies,
  normally through package scripts. After changing their dependencies, run
  `fixtures:lock` and include the updated lockfiles. TypeScript orchestration
  remains Effect-based; do not rewrite independent reference algorithms in it.
- Math supports `SCIPY_FIXTURE_OUTPUT_DIRECTORY` for generating into a separate
  review directory. Preserve reproducible timestamps and record actual reference
  dependency versions.
- Expected results come from independent implementations, published vectors, or
  documented mathematical derivations—not the implementation being tested.
- Review changed values, schema decoding, provenance, and affected behavioral
  tests together. Do not widen tolerances or restamp hashes just to turn a failure
  green. Integer/category results are exact; continuous comparisons use justified
  absolute and relative tolerances.
