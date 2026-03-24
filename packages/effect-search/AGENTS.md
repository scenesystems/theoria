---
description: Development guidelines for effect-search
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# effect-search

Standalone, MIT-licensed, Effect-native black-box optimization for TypeScript. Peer dependencies: `effect (^3.20.0)`, `@effect/platform`, `@effect/experimental`. Runtime dependencies: `@scenesystems/digest`, `effect-math`. This is the optimization engine consumed by `effect-dsp` for Bayesian search across optimizers (MIPROv2, GEPA, bootstrap, RLM, etc.).

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

All five gates (check, lint, test, build) must pass clean before any work is considered complete.

## Python Tooling (Fixture Generation Only)

Fixture generation uses [uv](https://docs.astral.sh/uv/) to run Python scripts with pinned Optuna dependencies. The script declares its dependencies inline via PEP 723 — `uv run` resolves them automatically. No manual `pip install`, `venv`, or system Python required.

- **Never use `python3` directly** — always `uv run`
- Committed fixture JSON in `test/fixtures/optuna/` is the test source of truth
- `bun run fixtures:check` schema-decodes every committed fixture through the TS `KnownFixtureSchema` union — catches generator ↔ schema drift
- `bun run fixtures:generate` regenerates fixtures from the generator script
- `bun run fixtures:lock` pins exact Python dependency versions (run once after changing PEP 723 deps, commit the `.lock` files)
- `bun run fixtures:verify` re-derives expected values from live Optuna and asserts committed fixtures still match
- Generator is decomposed: `scripts/fixtures/` has one module per FM family; `generate-optuna-fixtures.py` is the orchestrator

## Effect-Native Code Only

All code in `src/` and `test/` must be idiomatic Effect. No `async/await`, `throw/try-catch`, `new Error()`, `console.*`, `let`, `for/while`, `switch`, `Map/Set`, `Date.now()`, `Math.random()`, `JSON.parse/stringify`, `Promise.*`, or type assertions (`as`/`satisfies`). The local `eslint.config.mjs` enforces these with `--max-warnings=0`. Use `it.effect()` in tests.

## Conventions

- **Naming**: PascalCase modules (`SearchSpace`, `Sampler`), camelCase functions (`make`, `suggest`), UPPER_SNAKE for constants. Match Effect ecosystem conventions exactly.
- **Single source of truth**: Every type, error, and constant has one canonical definition. Never duplicate — import from the source.
- **No monoliths**: One concern per file. Decompose into `internal/` for implementation details, public modules for API surface. Every file should have a clear, singular responsibility.
- **Meaningful tests only**: Every test must assert a real behavioral contract from the spec. No smoke tests that just check "it doesn't throw". Property-based tests for mathematical invariants, golden fixtures for numerical correctness.
- **Future-proof organization**: New algorithm variants get their own files under `internal/` or `samplers/`. Never grow a file beyond its single responsibility — split early.

## Governance Enforcement

- **Internal boundary**: Only implementation modules under `src/internal/**`, `src/samplers/**`, `src/Sampler/**`, `src/Study/**`, and `src/experimental/**` may import `internal/*` paths.
- **Contract promotion rule**: Reusable cross-module abstractions must live in `src/contracts/**`; `internal/*` is private implementation only.
- **Experimental surface rule**: New `src/experimental/**` exports require explicit instability docs and fixture-backed deterministic tests.
- **File-size discipline**: Any `src/**/*.ts` file over 240 LOC must include a decomposition rationale and an explicit follow-up decomposition plan.
