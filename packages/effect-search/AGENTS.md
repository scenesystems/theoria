---
description: Development guidelines for @scenesystems/effect-search
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/effect-search

Standalone, MIT-licensed, Effect-native black-box optimization for TypeScript. Peer dependencies: `effect (^3.22.1)`, `@effect/platform (^0.97.1)`, `@effect/experimental (^0.61.1)`, and optional `@effect/sql (>=0.52.1)`. Runtime dependencies: `@scenesystems/digest`, `@scenesystems/effect-math`, `@scenesystems/effect-study`. This is the optimization engine consumed by `@scenesystems/effect-dsp` for Bayesian search across optimizers (MIPROv2, GEPA, bootstrap, RLM, etc.). Dependency direction is one-way: `effect-search` builds optimization policy on `effect-study`; `effect-study` never depends on search. Reusable evaluation, history, stop controls, event streams, generic schema-parameterized storage, and artifact persistence belong to `effect-study`. Search owns samplers, ranking, pruning, optimization snapshots, and checkpoint replay.

## Commands

| Task              | Command                     |
| ----------------- | --------------------------- |
| Type check        | `bun run check`             |
| Lint              | `bun run lint`              |
| Lint + fix        | `bun run lint:fix`          |
| Test              | `bun run test`              |
| Build             | `bun run build`             |
| Check fixtures    | `bun run fixtures:check`    |
| Generate fixtures | `bun run fixtures:generate` |
| Lock fixture deps | `bun run fixtures:lock`     |
| Verify fixtures   | `bun run fixtures:verify`   |

Use the narrowest package or owned-file checks that validate work in progress. The four repository gates (`check:all`, `lint`, `test`, `build`) are required before integration or release, not before a package-local handoff when downstream consumer migration is explicitly deferred. Report deferred consumer failures rather than editing packages outside the assigned scope.

## Python Tooling (Fixture Generation Only)

Fixture generation uses [uv](https://docs.astral.sh/uv/) to run Python scripts with pinned Optuna dependencies. The script declares its dependencies inline via PEP 723 — `uv run` resolves them automatically. No manual `pip install`, `venv`, or system Python required.

- **Never use `python3` directly** — always `uv run`
- Committed fixture JSON in `test/fixtures/optuna/` is the test source of truth
- `bun run fixtures:check` schema-decodes every committed fixture through the TS `KnownFixture` union — catches generator ↔ schema drift
- `bun run fixtures:generate` regenerates fixtures from the generator script
- `bun run fixtures:lock` pins exact Python dependency versions (run once after changing PEP 723 deps, commit the `.lock` files)
- `bun run fixtures:verify` re-derives expected values from live Optuna and asserts committed fixtures still match
- Generator is decomposed: `scripts/fixtures/` has one module per FM family; `generate-optuna-fixtures.py` is the orchestrator

## Effect-Native Code Only

Every TypeScript file in the package (`src/`, `test/`, `examples/`, `scripts/`) must be idiomatic Effect. No `async/await`, `throw/try-catch`, `new Error()`, `console.*`, `let`, `for/while`, `switch`, `Map/Set`, `Date.now()`, `Math.random()`, `JSON.parse/stringify`, `Promise.*`, or type assertions (`as`/`satisfies`). The repository `eslint.config.mjs` enforces these uniformly with `--max-warnings=0`; there is no package-local lint configuration. Use `it.effect()` in tests.

Theoria requires consuming Effect's public APIs inside callbacks as well as at boundaries. Use `Number`, `Boolean`, `Equal`, `Match`, `Array`, and other appropriate Effect modules for pure computation, selection, equality, and traversal. Use `@scenesystems/effect-math/Numeric` for mathematical operations owned there. Preserve laziness, refinement, numerical behavior, and typed failure channels when selecting an API. This is Theoria policy, not a claim that Effect universally forbids JavaScript operators in consumers.

## Conventions

- **Naming**: Match the owning module and Effect conventions: PascalCase modules, schemas, and classes (`SearchSpace`, `Sampler`), and camelCase functions and values (`make`, `suggest`). Domain-standard names may retain their established spelling; do not impose one constant style on unrelated work.
- **Single source of truth**: Every type, error, and constant has one canonical definition. Never duplicate — import from the source.
- **Boundary authorities are allowed**: `effect-search` stays generic optimization infrastructure, but it may depend on Scene-branded cryptographic boundary-authority packages when they are the canonical source for study provenance, audit, transport, verification, or cache identity. Today that includes `@scenesystems/digest`; future use of `@scenesystems/sign` or `@scenesystems/seal` must serve the same boundary-authority role.
- **No monoliths**: One concern per file. Decompose into `internal/` for implementation details, public modules for API surface. Every file should have a clear, singular responsibility.
- **Meaningful tests only**: Every test must assert a real behavioral contract from the spec. No smoke tests that just check "it doesn't throw". Property-based tests for mathematical invariants, golden fixtures for numerical correctness.
- **Future-proof organization**: Public concerns are flat modules under `src/`; implementation-only algorithm variants get focused files under `internal/`. Never grow a file beyond its single responsibility — split early.

## Governance Enforcement

- **Internal boundary**: `src/internal/**` is private implementation. Public modules may delegate to it, but consumers and examples use root namespaces or canonical concern subpaths.
- **Concern ownership**: Reusable public abstractions live in flat, concern-named modules. `Optimization`, `OptimizationEvent`, `OptimizationSnapshot`, and `OptimizationStorage` are search specializations; generic `StudyStorage`, `ArtifactContext`, and `ArtifactSink` belong to `effect-study`. Do not add catch-all public barrels or compatibility aliases.
- **Scene dependency allowlist**: Runtime dependencies on `@scenesystems/*` may provide shared mathematical and study foundations or boundary authorities defining cross-system cryptographic or provenance truth. Do not add dependencies on Scene domain, governance, registry, or app packages to `effect-search` runtime code.
- **Public surface discipline**: Scene-branded authority types may appear in the public API only when they are semantically part of `effect-search`'s contract. Do not re-export Scene packages merely for convenience, and keep implementation-only authority details behind package-owned abstractions.
- **Fixture placement**: Scenario fixtures are test support, not an experimental public API. Keep them in test fixtures and do not add public aliases for them.

## Study and optimization ownership

`Optimization`, `OptimizationEvent`, `OptimizationSnapshot`, and `OptimizationStorage` own search execution and persistence. Use `Optimization.run`/`Optimization.stream`, PascalCase `OptimizationEvent` constructors, and `InvalidOptimizationConfig`. Search artifact envelopes use the tags `OptimizationEvent` and `OptimizationSnapshot`. Schemas describe the current data directly; do not add format-version discriminators or compatibility APIs.

`OptimizationStorage` specializes the generic `@scenesystems/effect-study/StudyStorage` service with checkpoint and replay policy. Generic storage owns the tagged trial/snapshot journal and the default `study-storage.jsonl` filename. Optimization persistence does not require artifact services. Artifact producers import `ArtifactContext` and `ArtifactSink` from effect-study subpaths; sink emission is `emit(schema, artifact)`, `makeFileSystem` constructs a sink, and `layerFileSystem` provides one.
