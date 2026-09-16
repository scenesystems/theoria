---
description: Development guidelines for effect-math
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# effect-math

Effect-native mathematical and statistical foundations — numerics, linear algebra, geometry, probability, statistics, and optimization with typed errors, schema-validated inputs, and configurable runtime policies.

## Four Gates (Mandatory)

Every change must pass all four gates clean, run from the repository root — no bypasses, no suppressions:

```bash
bun run check:all    # Type check sources, tests and examples
bun run lint         # oxlint + ESLint Effect rules + dprint
bun run test         # Vitest contract tests
bun run build        # ESM + CJS + annotate-pure-calls
```

## Effect-Native Code Only

All code must be idiomatic Effect. See root `AGENTS.md` for the full banned-patterns table. Key constraints:

- **`Chunk<number>`** is the sole dense carrier — no `Float64Array`, no `ReadonlyArray` in public API
- **Effect `Number` module** for all arithmetic — `Number.sum`, `Number.multiply`, `Number.subtract`, not `+`, `-`, `*`
- **Tagged errors** — use `Data.TaggedError` when no codec is needed and `Schema.TaggedError` when the error crosses an encoded boundary; no `throw`, no `new Error()`
- **`Match.exhaustive`** for all dispatch — no `switch`, no `if/else` chains
- **`Effect.filterOrFail`** for all validation — no `if` statements
- **`onExcessProperty: "error"`** on all `Schema.decodeUnknown` boundary calls
- **No implicit math exceptions.** Deterministic IEEE 754 behavior does not authorize `Math.sqrt` or other JavaScript substitutes. Research Effect's public APIs and ecosystem integrations; obtain explicit authorization for any operation that remains unavailable before introducing a non-Effect implementation.

## Flat Concern Architecture

Public APIs are flat concern modules in `src/<Concern>.ts`, available through the matching package subpath and root namespace: `Numeric`, `Algebra`, `Special`, `LinearAlgebra`, `Geometry`, `Statistics`, `Complex`, `Calculus`, `Optimization`, `Probability`, `Distribution`, `Policy`, `Scalar`, `Backend`, `Precision`, `Autodiff`, `Uncertainty`, and `Computation`.

There is no required per-concern file template. Keep schemas, models, errors, services, and operations together when that is the clearest cohesive public module; extract private implementation by algorithm or subject under `internal/`. Public contracts and experimental discovery descriptors are not separate surfaces.

## Naming and Vocabulary

- Use Effect's exact public module names: `Array`, `BigDecimal`, `BigInt`, `Boolean`, `Number`, `Record`, and `String`. Do not abbreviate them or prefix them with `Effect`.
- Resolve overlapping operations with the owning domain namespace: `Numeric.sqrt` and `Complex.sqrt`, not renamed function imports. Direct imports keep their canonical names when there is no collision.
- Name internal namespaces for their mathematical subject or algorithm: `Arithmetic`, `Trigonometric`, `Integration`, `Ridder`, `Normal`, and `Beta`. Do not add `Kernel`, `Adapter`, `Bridge`, or compatibility suffixes to disambiguate imports.
- Pure implementations use their operation name, matching the public spelling, without a redundant `Kernel` suffix. Actual algorithm distinctions such as `gammaLanczos` retain their meaning. Public module-local errors use concise names such as `DecodeError`; stable wire tags such as `KernelExecutionError` may remain more specific.
- Operation forms use the base name, `Validated`, and `WithPolicies`. Precision variants use `Strict` or `Relaxed` only where they name an established policy contract. Distribution suffixes are `Pdf`, `Logpdf`, `Cdf`, `Quantile`, `Pmf`, and `Logpmf`.
- Casing follows semantic role: ordinary exported values remain camelCase, while established mathematical or protocol constants retain their conventional spelling. Do not convert every constant to UPPER_SNAKE mechanically.
- Keep conventional mathematical symbols for scalar variables and coefficients. These are not module aliases. Models and schemas use PascalCase; operations and values use camelCase; mathematical constants use their established notation or descriptive uppercase names.
- Apply the same vocabulary to implementation, tests, examples, scripts, and documentation. Upstream Python imports retain canonical names such as `numpy` and `scipy.special`, without shorthand aliases. This naming rule does not authorize a non-Effect implementation.
- Verify behavior through public APIs. Do not add tests of naming, guidance, inventories, or scaffolding.

## Consumer Operation Forms

Numerical concerns expose the forms that their behavior requires, commonly:

1. **Base operation** — a synchronous function for already trusted values.
2. **`Validated` operation** — decodes `unknown` with excess properties rejected and returns typed failures in `Effect`.
3. **`WithPolicies` operation** — reads the exact `Policy` services named by its Effect requirement, using payloads shaped as `{ policy: ... }`.

`Policy.layerDeterministic`, `Policy.layerNondeterministic`, and `Policy.Seed` provide the standard runtime policy layers. `Probability` owns entropy; normal and uniform density, cumulative, and transform operations belong to `Distribution`. Branded tolerances and execution failures belong to `Numeric`; dimensions and axes belong to `LinearAlgebra`; complex-step differentiation belongs to `Calculus`.

Every cross-concern abstraction must have a semantic owner. Do not create ownerless `shared` or `contracts` directories. Export maps prevent package consumers from importing `internal/*`; they do not prohibit relative internal imports within this package.

Schema is authoritative for encodable data. Abstract generic, callback, Layer, and service relationships may be represented directly with Effect-native TypeScript types or `Data.Class` when no codec is involved.

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
- `bun run fixtures:generate` runs the Effect entrypoint `scripts/generate-scipy-fixtures.ts`
- `bun run fixtures:lock` pins exact Python dependency versions (run after changing PEP 723 deps)
- Python is explicitly authorized for SciPy/NumPy reference computation, result conversion, and the JSON stdin/stdout protocol. These dependencies remain Python; this authorization does not extend to TypeScript computation or orchestration.
- Effect owns discovery, scoped Python processes, bounded concurrency, schema validation, filesystem writes, and manifest construction. `generate-scipy-fixtures.py` evaluates one requested family; `scripts/fixtures/` has one module per domain.
- `SCIPY_FIXTURE_OUTPUT_DIRECTORY` selects an alternate output directory for review before replacing committed references. `SCIPY_FIXTURE_GENERATED_AT` overrides the reproducible default timestamp `2026-03-23T00:00:00Z`.
- Provenance records the SciPy, NumPy, and Python versions actually used. Review numerical changes independently; do not weaken tolerances to accept regenerated output.

### Fixture Architecture

- **Python generators** (`scripts/fixtures/*.py`): one module per domain, each exports `generate(generated_at) -> list[dict]`
- **TS schemas** (`test/helpers/fixtures/schemas.ts`): discriminated unions per domain; `KnownFixtureSchema` owns the fixture vocabulary, with names derived from its members
- **TS registry** (`test/helpers/fixtures/registry.ts`): `loadFixture` reads the manifest and schema-decodes the requested document using `@effect/platform` services provided by `BunContext.layer`
- **Fixture-parity tests** (`test/{Domain}/fixture-parity.test.ts`): load via registry, decode through domain schema, dispatch via `Match.exhaustive`

### Rules

1. **Never import raw `.json` with `{ type: "json" }`** in fixture-parity tests — decode through Effect Schema from the registry
2. **No property guards** (`"x" in c.input`) — schema discriminated unions give typed narrowing via `Match.when`
3. **Never hardcode expected values** — derive from SciPy/NumPy or document the mathematical source
4. **One domain per module** — new fixture domains get a new file in `scripts/fixtures/`
5. **Fixture output must match TS schemas** — field names and shapes must align with `test/helpers/fixtures/schemas.ts`

## Docstrings

Every public export carries `@since 0.1.0` and `@category`. Explain when/why, not what. Publication-quality — no TODOs, no milestone refs, no future-tense promises.
