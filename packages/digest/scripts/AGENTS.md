---
description: Fixture and parity script governance for @scenesystems/digest
globs: "**/*"
alwaysApply: true
---

# Digest Script Rules

Scripts in this directory are the source of truth for fixture lifecycle automation.

## Invariants

1. Keep parity generation deterministic (pinned dependencies + fixed generatedAt defaults).
2. Generate fixture outputs into `test/fixtures/parity/generated/` and commit those outputs.
3. Validate fixture payload schema and provenance manifest contracts in `fixtures:check`.
4. Never derive expected conformance results from runtime implementation during tests.
5. Keep external provenance metadata in `test/fixtures/external/sources.manifest.json` synchronized via `fixtures:stamp`.

## Commands

- `bun run fixtures:generate`
- `bun run fixtures:check`
- `bun run fixtures:stamp`
- `bun run fixtures:verify`
