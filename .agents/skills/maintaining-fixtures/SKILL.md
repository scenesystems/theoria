---
name: maintaining-fixtures
description: Maintains independent, reproducible reference data. Use when changing fixtures, conformance corpora, provenance, or generators.
---

# Maintaining fixtures

- Maintain independent evidence for the intended behavior. Execute the real
  upstream implementation for parity fixtures; use published standards corpora
  for conformance and focused examples for regressions. A complete standards
  corpus is not unnecessary volume. Never generate expectations from Theoria's
  implementation or substitute hand-authored answers for upstream execution.
- Keep one authoritative reference target. When updating it, replace obsolete
  fixtures and consumers rather than preserving a second pin or legacy corpus
  to keep tests green. Record the upstream revision, relevant transformations,
  and license information with the data or generator, not in parallel reports.
- Use the root Python dependency declarations and lock with `uv run --locked`.
  Update reference dependencies deliberately; do not refresh locks during routine
  regeneration. Upstream versions identify the reference, not a fixture format.
  Decode the current data shape with Effect Schema; do not introduce format
  counters, migration decoders, schema registries, or compatibility frameworks.
- Make regeneration reproducible: control randomness, ordering, and numerical
  runtime settings in the generator. Investigate machine-dependent output rather
  than skipping regeneration on other machines or loosening comparisons. Tests
  consume committed data; reference generation and verification run separately.
- Review regenerated differences before replacing references or updating hashes.
  Use the existing non-writing regeneration check where available. Byte equality
  establishes reproducibility, not correctness; run behavioral tests as well.
  Never hand-patch reference answers or weaken assertions to accept new output.
- Compare meaningful decisions and results: identities, order, boundaries, and
  numerical values—not just counts or metadata. Use exact discrete comparisons
  and justified numerical tolerances. Separate matched behavior, intentional
  differences, and unresolved mismatches; do not claim parity beyond the evidence.
- Reference agreement alone does not establish browser correctness. For text,
  distinguish controlled-metric layout tests, differential reference tests, and
  real browser/font behavior. Explain intentional public differences in API docs
  or guides rather than hiding them in fixture notes.

## Running fixtures

Read the affected package's scripts and consuming tests. Use existing entrypoints,
not a new orchestration layer. From the package directory:

| Package                        | Generate                                            | Verify reference regeneration                        |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| `effect-math`, `effect-search` | `bun run fixtures:generate`                         | `bun run fixtures:verify`                            |
| `effect-dsp`                   | `uv run --locked scripts/generate-dspy-fixtures.py` | Add `--check` to the generation command              |
| `effect-text`                  | `bun run scripts/generate-unicode.ts`               | Review the generated diff and run the affected tests |

Generation overwrites committed output; use a generator's output-directory option
when reviewing a proposed reference update. The Unicode generator downloads
upstream data and updates production property tables as well as test vectors.
Do not add a generator for a corpus that only needs direct import and attribution.

Run the affected behavioral tests from the repository root, for example:

```sh
bun run test packages/effect-text/test/Text/grapheme.test.ts
```

Existing provenance checks are not a template for new harnesses, manifests, or
tests of inventories and version labels. Add only what the evidence requires.
