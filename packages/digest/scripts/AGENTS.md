---
description: Fixture script governance for @scenesystems/digest
globs: "**/*"
alwaysApply: true
---

# Digest Script Rules

Scripts in this directory are the source of truth for fixture lifecycle automation.

`fixtures.ts` owns corpus schemas, manifest types, validation, and loading. Scripts and conformance suites import this module directly; do not recreate schemas or add re-export aliases in test helpers. Preserve upstream wire field names and fixture kind literals.

## Invariants

1. Implement fixture lifecycle tooling in TypeScript with Effect.
2. Validate fixture payload schema and provenance manifest contracts in `fixtures:check`.
3. Never derive expected conformance results from the runtime implementation under test.
4. Keep external provenance metadata in `test/fixtures/external/sources.manifest.json` synchronized via `fixtures:stamp`.

## Commands

- `bun run fixtures:check`
- `bun run fixtures:stamp`
- `bun run fixtures:verify`
