---
description: Development guidelines for effect-math
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# effect-math

Effect-native mathematical and statistical foundations — numerics, linear algebra, geometry, probability, statistics, and optimization with typed errors, schema-validated inputs, and configurable runtime policies.

## Five Gates (Mandatory)

Every change must pass all five gates clean — no bypasses, no suppressions:

```bash
bun run check        # Type check source
bun run check:tests  # Type check tests
bun run lint         # ESLint with Effect rules
bun run test         # Vitest contract tests
bun run build        # ESM + CJS + annotate-pure-calls
```

## Effect-Native Code Only

All code must be idiomatic Effect. See root `AGENTS.md` for the full banned-patterns table. Key constraints:

- **`Chunk<number>`** is the sole dense carrier — no `Float64Array`, no `ReadonlyArray` in public API
- **Effect `Number` module** for all arithmetic — `N.sum`, `N.multiply`, `N.subtract`, not `+`, `-`, `*`
- **`Schema.TaggedError`** for all errors — no `throw`, no `new Error()`
- **`Match.exhaustive`** for all dispatch — no `switch`, no `if/else` chains
- **`Effect.filterOrFail`** for all validation — no `if` statements
- **`onExcessProperty: "error"`** on all `Schema.decodeUnknown` boundary calls
- **`Math.sqrt`** is the only allowed plain JS math function (deterministic IEEE 754 leaf)

## Domain Architecture

Nine domains, each with the same file structure:

| Domain        | Stability    | Surface                                               |
| ------------- | ------------ | ----------------------------------------------------- |
| Numeric       | provisional  | Scalar transforms, safe division, transcendentals     |
| LinearAlgebra | provisional  | Dense vector/matrix ops over Chunk carriers           |
| Geometry      | **stable**   | Metric distances, midpoint, centroid                  |
| Probability   | provisional  | Normal/uniform PDF/CDF, Shannon entropy               |
| Statistics    | provisional  | Mean, variance, stddev, covariance, SummaryStatistics |
| Algebra       | experimental | Scaffolded                                            |
| Calculus      | experimental | Scaffolded                                            |
| Special       | experimental | Scaffolded                                            |
| Optimization  | experimental | Scaffolded                                            |

Each domain owns: `contract.ts`, `model.ts`, `schema.ts`, `errors.ts`, `operations.ts`, `internal/`, `index.ts`.

## Three-Tier Operation Pattern

1. **Pure kernel** — synchronous function on `Chunk<number>`, no Effect wrapper
2. **Effect-wrapped** — Schema decode with `onExcessProperty: "error"`, typed errors
3. **Policy-aware** — reads `PrecisionPolicyService`/`DiagnosticsPolicyService` via `Context.Tag`

## Ownership Boundaries

- **Probability** owns distributions and measure-space contracts — Statistics must import, never redeclare
- **Statistics** owns estimators, inference, and diagnostics that consume Probability contracts
- **Cross-domain `internal/` imports are forbidden** — blocked by exports map
- **`contracts/shared/`** holds ownerless cross-cutting primitives (branded scalars, boundary errors, runtime policies)

## Fixture Testing (SciPy Golden Reference)

| Task              | Command                     |
| ----------------- | --------------------------- |
| Check fixtures    | `bun run fixtures:check`    |
| Generate fixtures | `bun run fixtures:generate` |
| Lock Python deps  | `bun run fixtures:lock`     |

### Python Tooling

Fixture generation uses [uv](https://docs.astral.sh/uv/) with PEP 723 inline metadata — never use `python3` directly.

- Committed fixture JSON in `test/fixtures/scipy/` is the test source of truth
- `bun run fixtures:check` schema-decodes every committed fixture through the TS `KnownFixtureSchema` union — catches generator ↔ schema drift
- `bun run fixtures:generate` regenerates fixtures from the generator script
- `bun run fixtures:lock` pins exact Python dependency versions (run after changing PEP 723 deps)
- Generator is decomposed: `scripts/fixtures/` has one module per domain; `generate-scipy-fixtures.py` is the orchestrator

### Fixture Architecture

- **Python generators** (`scripts/fixtures/*.py`): one module per domain, each exports `generate(generated_at) -> list[dict]`
- **TS schemas** (`test/helpers/fixtures/schemas.ts`): typed discriminated unions per domain, `KnownFixtureSchema` union of all 5
- **TS registry** (`test/helpers/fixtures/registry.ts`): `FixtureRegistry` Context.Tag, `loadFixture` helper, `@effect/platform` + `@effect/platform-bun` for file I/O
- **Fixture-parity tests** (`test/{Domain}/fixture-parity.test.ts`): load via registry, decode through domain schema, dispatch via `Match.exhaustive`

### Rules

1. **Never import raw `.json` with `{ type: "json" }`** in fixture-parity tests — decode through Effect Schema from the registry
2. **No property guards** (`"x" in c.input`) — schema discriminated unions give typed narrowing via `Match.when`
3. **Never hardcode expected values** — derive from SciPy/NumPy or document the mathematical source
4. **One domain per module** — new fixture domains get a new file in `scripts/fixtures/`
5. **Fixture output must match TS schemas** — field names and shapes must align with `test/helpers/fixtures/schemas.ts`

## Docstrings

Every public export carries `@since 0.1.0` and `@category`. Explain when/why, not what. Publication-quality — no TODOs, no milestone refs, no future-tense promises.
