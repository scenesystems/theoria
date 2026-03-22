---
description: Development guidelines for theoria monorepo
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# Theoria

Effect-native scientific computing monorepo.

| Package              | Directory                 | npm                    | Deps                                  |
| -------------------- | ------------------------- | ---------------------- | ------------------------------------- |
| effect-search        | `packages/effect-search/` | `effect-search`        | effect, @scenesystems/digest          |
| effect-dsp           | `packages/effect-dsp/`    | `effect-dsp`           | effect-search, @effect/ai (peer)      |
| effect-math          | `packages/effect-math/`   | `effect-math`          | effect                                |
| @scenesystems/digest | `packages/digest/`        | `@scenesystems/digest` | @noble/hashes (core), effect (schema) |

`@scenesystems/digest` has two entrypoints: `.` (pure core, zero Effect) and `./schema` (Effect Schema layer). Theoria packages consume it through `./schema`. Published under `@scenesystems/` scope for cross-ecosystem use.

---

## Rules

1. **USE `bun` ONLY.** Never `npm`, `npx`, `yarn`, `pnpm`.
2. **FOUR GATES.** `bun run check && bun run lint && bun run test && bun run build` — all green before work is complete.
3. **YOU OWN ALL ERRORS.** You see it, you own it, you fix it.
4. **NEVER USE `git stash`.** Ask the user how to proceed.
5. **RUN CLI COMMANDS.** VS Code diagnostics are insufficient.

---

## Commands

| Task       | Command         |
| ---------- | --------------- |
| Type check | `bun run check` |
| Lint       | `bun run lint`  |
| Test       | `bun run test`  |
| Build      | `bun run build` |
| Clean      | `bun run clean` |

Per-package: `bun --filter effect-search run check`

Before committing: `bun run check && bun run lint && bun run test`

---

## Vendored Source Reference

The Effect-TS monorepo source is vendored at `.vendor/effect/` for direct reading. When you need to understand how an Effect API works internally, read the source — don't guess or hallucinate signatures.

```bash
bun run vendor:check   # see if versions drifted
bun run vendor:sync    # sync to installed versions
```

See `.vendor/AGENTS.md` for the full package→directory map.

---

## Reference Architecture — The Oracle Pattern

The packages in theoria were originally developed in `scenesystems/eva`. When you need to understand how a module works, what tests cover it, or what governance constraints apply, use the `librarian` tool to read from `github.com/scenesystems/eva` — specifically `effect-search/` and `effect-dsp/`.

**Never `cp` a file from eva to theoria. Always reconstruct from understanding.**

The reconstruction process is the code review. Structure code for improvements found during review, write tests first or alongside, ensure every file passes lint from the start.

### Workflow per module

1. **Read**: Use `librarian` to read the relevant source files in eva. Understand the logic, tests, and governance constraints.
2. **Implement**: Write the module from understanding in theoria. Fix past design mistakes with hindsight.
3. **Verify**: All four gates pass. Golden fixtures match reference implementations.

---

## Effect-Native Code Only

All code in `src/`, `test/`, and `examples/` must be idiomatic Effect. Enforced by `eslint.config.mjs` with `--max-warnings=0`. Use `it.effect()` in tests.

| Banned                             | Use Instead                                          |
| ---------------------------------- | ---------------------------------------------------- |
| `async/await`                      | `Effect.gen` with `yield*`                           |
| `throw`, `try/catch`               | `Data.TaggedError`, `Schema.TaggedError`             |
| `new Error()`                      | `Data.TaggedError` or `Schema.TaggedError`           |
| `console.*`                        | `Effect.log`, `Effect.logError`, `Effect.logWarning` |
| `let`                              | `const`. Mutable state: `Ref`                        |
| `for`, `while`, `do...while`       | `Arr.map`, `Effect.forEach`, `Effect.iterate`        |
| `switch`                           | `Match` from effect                                  |
| `new Map()` / `new Set()`          | `HashMap` / `HashSet` from effect                    |
| `Date.now()`, `Math.random()`      | `Clock.currentTimeMillis`, `Random` from effect      |
| `as` assertions, `satisfies`       | `Schema.decodeUnknown`, `Schema.is`                  |
| `JSON.parse/stringify`             | `Schema.decode` / `Schema.encode`                    |
| `Object.keys/entries/values`       | `Record` module from effect                          |
| `Array.push`                       | `Arr.append` / `Arr.appendAll`                       |
| `Promise.*`, `.then()`, `.catch()` | `Effect.all`, `Effect.map`, `Effect.catchAll`        |
| `Effect.runPromise/runSync`        | `Runtime.runMain` at entry points only               |
| TypeScript `interface`             | `Schema.Class`, `Data.TaggedClass`                   |
| `Partial<>`, `Pick<>`, `Omit<>`    | `Schema.partial`, `Schema.pick`, `Schema.omit`       |

---

## Conventions

- **Naming**: PascalCase modules, camelCase functions, UPPER_SNAKE constants. Match Effect ecosystem.
- **Single source of truth**: One canonical definition per type, error, constant. Never duplicate.
- **One concern per file**: `internal/` for implementation, public modules for API surface.
- **240 LOC limit**: Files over 240 LOC require decomposition rationale and split plan.
- **Tests assert contracts**: Property-based for invariants, golden fixtures for numerical correctness. No smoke tests.
- **Docgen**: Every public export carries `@since`, `@category`, examples where non-obvious.

---

## Governance

- `internal/*` blocked from consumers via exports map. Enforced by governance tests.
- Reusable cross-module abstractions live in `src/contracts/`. `internal/*` is private.
- Adding algorithms must not require modifying unrelated internals.
- All randomness through Effect `Random` with seeded generators.

---

## Structure

| Directory                 | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `packages/effect-search/` | Bayesian optimization — TPE, MOTPE, HyperBand/BOHB, c-TPE      |
| `packages/effect-dsp/`    | Declarative signal programming — DSPy paradigm for Effect      |
| `packages/effect-math/`   | Mathematical and statistical foundations                       |
| `packages/digest/`        | Content hashing, JCS canonicalization (`@scenesystems/digest`) |
| `.agents/skills/`         | Portable Effect-native skills                                  |
| `.changeset/`             | Independent versioning per package                             |
| `packages/*/AGENTS.md`    | Package-specific governance                                    |

---

## Releases

Uses [Changesets](https://github.com/changesets/changesets) for independent per-package versioning.

```bash
bun run changeset              # Create a changeset
bun run changeset:version      # Apply version bumps
bun run changeset:publish      # Publish to npm
```

Each package runs `publish:check` before release to enforce repository metadata, export boundaries, and keyword coverage.

---

## Commits

**Types:** `feat`, `fix`, `docs`, `test`, `chore`, `refactor`

**Scopes:** `effect-search`, `effect-dsp`, `effect-math`, `digest`, `root`

```bash
git commit -m "feat(effect-search): add TPE categorical sampler"
```

---

## Testing

- RED → GREEN → REFACTOR. Tests first.
- Golden fixtures from reference implementations (Optuna, DSPy).
- Fixture generation uses `uv run` — never `python3` directly.
- Property-based tests via `fast-check`.
- Tolerances: exact for integers/categories; mixed absolute + relative for continuous math.

---

## Skills Reference

| Skill                           | When to Load                          |
| ------------------------------- | ------------------------------------- |
| `skill:idiomatic-effect`        | Writing Effect code                   |
| `skill:effect-testing`          | Writing tests with `@effect/vitest`   |
| `skill:effect-services`         | Designing services and layers         |
| `skill:effect-error-management` | Designing typed error channels        |
| `skill:effect-branded-types`    | Creating branded/nominal types        |
| `skill:effect-data-primitives`  | Using Data module primitives          |
| `skill:engineering-excellence`  | Structural patterns and decomposition |
| `skill:target-state-tdd`        | TDD workflow                          |
| `skill:mermaid-diagrams`        | Architecture diagrams                 |
