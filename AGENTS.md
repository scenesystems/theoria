---
description: Development guidelines for theoria monorepo
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# Theoria

Effect-native scientific computing monorepo.

| Package              | Directory                    | npm                              | Deps                                                      |
| -------------------- | ---------------------------- | -------------------------------- | --------------------------------------------------------- |
| effect-search        | `packages/effect-search/`    | `@scenesystems/effect-search`    | effect, @scenesystems/digest                              |
| effect-dsp           | `packages/effect-dsp/`       | `@scenesystems/effect-dsp`       | @scenesystems/effect-search, @effect/ai (peer)            |
| effect-text          | `packages/effect-text/`      | `@scenesystems/effect-text`      | effect, @scenesystems/effect-search                       |
| effect-math          | `packages/effect-math/`      | `@scenesystems/effect-math`      | effect                                                    |
| effect-inference     | `packages/effect-inference/` | `@scenesystems/effect-inference` | @effect/ai, effect                                        |
| @scenesystems/digest | `packages/digest/`           | `@scenesystems/digest`           | @noble/hashes, effect                                     |
| @scenesystems/seal   | `packages/seal/`             | `@scenesystems/seal`             | @noble/ciphers, effect                                    |
| @scenesystems/sign   | `packages/sign/`             | `@scenesystems/sign`             | @noble/curves, @noble/hashes, @noble/post-quantum, effect |

The cryptographic authority packages `@scenesystems/digest`, `@scenesystems/seal`, and `@scenesystems/sign` have a single entrypoint (`.`). The scoped effect packages retain their governed public subpaths. Effect is a required peer dependency. Schema is the single source of truth for all types. Published under `@scenesystems/` scope for cross-ecosystem use. Built on the [Noble](https://paulmillr.com/noble/) audited cryptographic ecosystem (6 audits by Cure53 and Trail of Bits).

---

## Rules

1. **USE `bun` ONLY.** Never `npm`, `npx`, `yarn`, `pnpm`. Use `bunx` for CLI tools.
2. **FOUR GATES.** `bun run check:all && bun run lint && bun run test && bun run build` — all green before work is complete. `check:all` type-checks sources, tests, examples, scripts, and benchmarks.
3. **YOU OWN ALL ERRORS.** You see it, you own it, you fix it.
4. **NEVER USE `git stash`.** Ask the user how to proceed.
5. **RUN CLI COMMANDS.** VS Code diagnostics are insufficient.

---

## Commands

| Task                                            | Command                  |
| ----------------------------------------------- | ------------------------ |
| Type check (src + scripts)                      | `bun run check`          |
| Type check (test)                               | `bun run check:tests`    |
| Type check (examples, package scripts, benches) | `bun run check:examples` |
| Type check (everything)                         | `bun run check:all`      |
| Lint                                            | `bun run lint`           |
| Test                                            | `bun run test`           |
| Build                                           | `bun run build`          |
| Clean                                           | `bun run clean`          |

Per-package: `bun run --filter '@scenesystems/effect-math' check`

**CRITICAL:** The `--filter` flag goes after `run`, NOT before it. The pattern matches package names from `package.json`, not directory paths. Glob patterns work: `bun run --filter '@scenesystems/*' build`.

Before committing: `bun run check:all && bun run lint && bun run test`

For `apps/theoria` dev work, use the checked-in runbook: `bun run app:theoria:tmux`. Treat the frontend dev server port as fixed at `5175`; do not improvise alternate Vite ports unless the user explicitly asks for a config change.

---

## Vendored Source Reference

The Effect-TS monorepo source is vendored at `.vendor/effect/` for direct reading.
Read it to establish public API contracts, types, semantics, and supported
consumer composition. Effect implements abstractions; we consume them. Its
internal operators, loops, mutation, assertions, and native JavaScript or
TypeScript never authorize bypassing the public APIs here. Apply that distinction
to upstream tests and examples too; do not guess or hallucinate signatures.

```bash
bun run vendor:check   # see if versions drifted
bun run vendor:sync    # sync to installed versions
```

See `.vendor/AGENTS.md` for the full package→directory map.

---

## Effect-Native Code Only

**Native Effect means consuming the appropriate public Effect APIs throughout
every implementation, not imitating Effect's internal JavaScript or TypeScript.**
This is mandatory in pure computation, callbacks, helpers, data and type models,
services, providers, UI, tests, fixtures, examples, scripts, benchmarks, and
tooling. Framework configuration is not exempt: required declarations do not
authorize non-native program logic. Use native `@effect/vitest` composition for
tests, including `it.effect()` for Effect behavior.

Public means supported by the installed package's public exports and consumer
declarations, not merely exported from upstream source. No dependency-internal
imports, APIs marked internal, invented APIs, or assertions to reach unavailable
APIs. Resolve version drift against the installed public contract. These module
names and banned examples illustrate rather than limit the mandate; it applies
to newly encountered concerns and future Effect versions. Prefer the dedicated
public combinator over rebuilding its behavior from lower-level operations.
A first-party wrapper, alias, re-export, or Effect-sounding package name cannot
launder a prohibited implementation; every first-party owner follows the rule.

- Use `Boolean`, `Predicate`, `Match`, `Option`, `Either`, and Effect control
  flow instead of native ternaries, `if`/`else`, `switch`, short-circuit
  operators, or nullable branching. Closed variants require exhaustive handling.
- Use native collection and traversal APIs, `Equal`, `Equivalence`, `Order`,
  `Ordering`, `Number`, `String`, and the appropriate Effect mathematical APIs
  for every operation, including inside callbacks and pure numeric kernels.
  No native collection methods, loops, mutable accumulators, operators,
  `Object.*`, or spread-based substitutes.
- Schema owns validated data, codecs, brands, transformations, and derived
  types. Use native Schema/Data classes, tagged values, errors, and collections.
  No parallel handwritten models, plain `ReadonlyArray`, TypeScript `Record`,
  `Readonly`/utility-type substitutes, casts, `as const`, `satisfies`, non-null
  assertions, or `any`/`unknown` escape hatches. Schema-derived `Type` and
  `Encoded` and native API declarations are consumers, not substitute models.
- Use native services, Layers, typed errors, scopes, fibers, streams, retries,
  state, time, randomness, and observability. Consume Platform and ecosystem
  integrations before designing adapters. Bun is the default executable host;
  Node requires explicit owner direction. Atom owns reactive state and lifetime,
  including transient element observation; do not replace it with React state
  or effect escape hatches or ad hoc Promise state.
- Keep pure native APIs pure. An outer Effect return type, `Effect.gen`,
  `Effect.sync`, or service wrapper cannot make a non-native body compliant.
  Preserve laziness, narrowing, ordering, equality, failures, cancellation,
  resource lifetimes, and numeric semantics through native composition.
- Verify actual contracts, not API-name analogies: concurrency defaults, first
  success versus first completion, finalizer failure, numeric edge cases, and
  nested equality matter. Outer Data/Schema constructors do not make nested
  plain values structural or deeply immutable. No unsafe extraction, unchecked
  validation, or ambient-time substitute for typed failure or service ownership.
  Expected failures stay typed; invariant defects and interruption retain their
  `Cause` semantics rather than being relabeled as recoverable errors.
- No exemption follows from simplicity, performance, deterministic math,
  adapter/host naming, configuration, fixtures, current source, upstream
  implementation, recorded lint debt, or green checks. Research the exact
  installed public APIs, exports, source, tests, and official integrations for
  an unresolved need. Report the exact requirement; do not authorize a fallback,
  weaken enforcement, suppress diagnostics, or defer an encountered violation.
  Only explicit owner direction can authorize a departure.

Apply these requirements across the entire declared work scope and its real
consumers/providers, not only newly added lines or examples named by the user.
Skills, local guidance, examples, and reviewer advice cannot weaken the mandate.

**You encounter it, you own fixing it forward.** Encountering a prohibited
implementation, workaround, or testing pattern makes its correction part of the
current work, even when it predates the task, belongs to another module, or was
outside the initial assignment. Do not leave it behind as "pre-existing,"
"unrelated," "not assigned," optional cleanup, a TODO, or a follow-up instead
of correcting it.

Fix the canonical implementation with public native Effect APIs and migrate the
affected consumers and providers needed for a coherent correction. Preserve
intended behavior and verify the correction; wrappers, assertions, suppressions,
weaker policy, and temporary substitutes do not resolve it. Rewrite a banned
test around any meaningful first-party behavioral claim through the real public
API. Remove tests that protect no first-party behavior rather than replacing
them with another inventory or trivial assertion. Never delete useful coverage
or weaken expectations merely to obtain green checks.

This standing ownership does not authorize unrelated features or overwriting
concurrent work. Coordinate writable ownership and respect explicit read-only
and approval boundaries; obtain required access rather than treating them as
scope excuses. A genuine blocker remains an explicit unresolved correction, not
a completed delivery. Leave the codebase better by resolving encountered
problems, not just listing them.

Enforcement is split by tool, each owning one concern, all wired into `bun run lint`:

- `eslint/` (entry `eslint.config.mjs`) owns the Effect discipline only: `no-restricted-syntax` AST selectors parsed with `@babel/eslint-parser`, one rule set (core, type modeling, Option discipline) applied to every TypeScript file. There are no per-directory scopes or weaker tiers. Current tooling excludes framework configuration (`**/*.config.*`) and built assets (`apps/*/public/**`); exclusions describe enforcement coverage, not permission for non-native first-party logic. Inline configuration is disabled (`noInlineConfig`), so no file may carry a lint or type-checker suppression comment. Do not add or broaden exceptions to admit prohibited code.
- `.oxlintrc.json` owns every generic JavaScript and TypeScript rule: correctness, `no-unused-vars`, `no-explicit-any`, import hygiene, the Node builtin ban (`import/no-nodejs-modules`), and the `@ts-*` directive ban. It has no path overrides. Warnings fail the run (`denyWarnings`). Two rules are intentionally off: `require-yield` (an `Effect.gen` body without `yield*` is a legitimate idiom) and `typescript/prefer-as-const` (conflicts with the `as` ban). The two linters do not overlap.
- `.dprint.json` owns formatting.
- `@effect/tsgo` adds Effect diagnostics inside `tsc`.

- Never import Node builtins (`node:*`, `fs`, `path`, `url`, `crypto`) from TypeScript. Use `@effect/platform`, Bun platform services, or package-owned abstractions instead.
- Tests must exercise behavior, numerical parity, protocol conformance, lifecycle, interruption, typed failures, persistence, or a real integration boundary. Do not test source structure, file inventories, export-map shape, package metadata, generated distribution layout, or checked-in release snapshots.

| Banned                                                            | Use Instead                                                                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `async/await`                                                     | `Effect.gen` with `yield*`                                                                                                                                               |
| `throw`, `try/catch`                                              | Native typed failure/recovery for expected errors; preserve defects and interruption in `Cause`; translate authorized foreign exceptions once                            |
| `new Error()`                                                     | `Data.TaggedError` or `Schema.TaggedError` for expected failures; `Effect.die` for a genuine invariant defect, never as a recovery shortcut                              |
| `console.*`                                                       | `Effect.log`, `Effect.logError`, `Effect.logWarning`                                                                                                                     |
| `let`                                                             | `const`. Mutable state: `Ref`                                                                                                                                            |
| `for`, `while`, `do...while`                                      | `Arr.map`, `Effect.forEach`, `Effect.iterate`                                                                                                                            |
| `switch`                                                          | `Match` from effect                                                                                                                                                      |
| `new Map()` / `new Set()`                                         | `HashMap` / `HashSet` from effect                                                                                                                                        |
| `Date.now()`, `Math.random()`                                     | `Clock.currentTimeMillis`, `Random` from effect                                                                                                                          |
| `as` assertions, `satisfies`                                      | Untrusted input: decode with its owning Schema; internal values: correct the owning type relationship or use native narrowing                                            |
| `JSON.parse/stringify`                                            | Decode/encode through `Schema.parseJson` composed with the owning Schema; retain typed parse failures                                                                    |
| `Object.keys/entries/values`                                      | `Record` module from effect                                                                                                                                              |
| `Array.push`                                                      | `Arr.append` / `Arr.appendAll`                                                                                                                                           |
| `Promise.*`, `.then()`, `.catch()`                                | `Effect.all`, `Effect.map`, `Effect.catchAll`                                                                                                                            |
| `Effect.runPromise/runSync`                                       | `BunRuntime.runMain` at executable entry points; Atom-owned execution in UI                                                                                              |
| TypeScript `interface`                                            | `Schema.Class`, `Data.TaggedClass`                                                                                                                                       |
| `Partial<>`, `Pick<>`, `Omit<>`                                   | `Schema.partial`, `Schema.pick`, `Schema.omit`                                                                                                                           |
| `Readonly<{…}>`, `type X = {…}`, `type X = A & {…}`               | `Schema.Struct` for data; `Data.Class<{…}>` for records that carry functions, Effects, Layers or generics                                                                |
| `\| null`, `\| undefined`, `=== null`, `typeof x === "undefined"` | `Option<A>`; `Schema.OptionFromNullOr` where JSON carries `null`                                                                                                         |
| `Option.getOrUndefined/getOrNull`, `onNone: () => undefined`      | Keep the `Option`; use Schema property transformations or the researched native integration for external optional fields, never spread-based substitute models           |
| `globalThis`, `localStorage`, `Bun.*`, `crypto.*`                 | A service: `@effect/platform-browser` (`BrowserKeyValueStore`, `Clipboard`), `@effect/platform-bun`, `@scenesystems/digest`, `generateEntropy` from `@scenesystems/sign` |
| `new URL()`, `fetch()`                                            | `Url.fromString`, `HttpClient` from `@effect/platform`                                                                                                                   |
| `setTimeout/setInterval`, `requestAnimationFrame`, `performance`  | `Effect.sleep`, `Schedule`, `Clock.currentTimeNanos`; the app's `AnimationFrame` service or Motion's `frame`                                                             |
| `process.*` (every property, including `memoryUsage`, `versions`) | `Config`, `Console`, `Path` + `import.meta.url`, `Clock`, `BunRuntime.runMain` (exit code 1 on failure); what Effect cannot observe is not reported                      |

---

## Conventions

- **Naming**: PascalCase modules, camelCase functions, UPPER_SNAKE constants. Match Effect ecosystem.
- **Single source of truth**: One canonical definition per type, error, constant. Never duplicate.
- **One concern per file**: `internal/` for implementation, public modules for API surface.
- **Tests assert behaviour**: Property-based for invariants, golden fixtures for numerical correctness. No smoke tests, and no tests that pin structure (export inventories, literal class strings, `_tag` lists, self-equality) rather than behaviour.
- **API documentation**: Every public export carries a summary, `@since`, `@category`, and examples where non-obvious. Every entrypoint `index.ts` (and every source file that becomes a docs page) opens with a `/** … @since … @module */` header; `bun run docs:api` fails without it.

---

## Governance

- `internal/*` is unreachable from consumers: each `package.json` `exports` map omits it, so the type checker and the runtime resolver both reject deep imports.
- Reusable cross-module abstractions live in `src/contracts/`. `internal/*` is private.
- Adding algorithms must not require modifying unrelated internals.
- Non-cryptographic randomness (sampling, search, fixtures) goes through Effect `Random` with seeded generators so runs replay. Key material, nonces and signing entropy come from the platform CSPRNG through `generateEntropy` in `@scenesystems/sign`; `Random` is never a source of secrets.
- Cryptographic authority packages (`digest`, `seal`, `sign`): single entrypoint (`.`), Effect required, Schema is sole type source. Scoped effect packages retain their governed public subpaths.

---

## Structure

| Directory                 | Purpose                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| `packages/effect-search/` | Bayesian optimization — TPE, MOTPE, HyperBand/BOHB, c-TPE                   |
| `packages/effect-dsp/`    | Declarative signal programming — DSPy paradigm for Effect                   |
| `packages/effect-text/`   | Text preparation, measurement seams, greedy multiline layout                |
| `packages/effect-math/`   | Mathematical and statistical foundations                                    |
| `packages/digest/`        | Content hashing, JCS canonicalization (`@scenesystems/digest`)              |
| `packages/seal/`          | Authenticated encryption (`@scenesystems/seal`)                             |
| `packages/sign/`          | Digital signatures, key agreement, key encapsulation (`@scenesystems/sign`) |
| `.agents/skills/`         | Portable Effect-native skills                                               |
| `.changeset/`             | Independent versioning per package                                          |
| `packages/*/AGENTS.md`    | Package-specific governance                                                 |

---

## Releases

Uses [Changesets](https://github.com/changesets/changesets) for independent per-package versioning.

```bash
bun run changeset              # Create a changeset
bun run changeset:version      # Apply version bumps
bun run release:check          # Type checks, lint, behavioral tests, production build
```

Publishing happens only in the `Publish Packages` workflow (`.github/workflows/publish.yml`, manual dispatch on `main`) through npm Trusted Publishing. Its `pack` job runs `release:check` and packs the unpublished versions into tarballs; its `publish` job holds the OpenID Connect token and publishes those tarballs, then pushes the tags and creates the GitHub releases.

---

## Commits

**Types:** `feat`, `fix`, `docs`, `test`, `chore`, `refactor`

**Scopes:** `effect-search`, `effect-dsp`, `effect-text`, `effect-math`, `digest`, `seal`, `sign`, `root`

```bash
git commit -m "feat(effect-search): add TPE categorical sampler"
```

---

## Testing

- No tests about tests, guidance, inventories, or scaffolding. Every test must
  distinguish a plausible defect in first-party behavior; reasserting configured
  mock values, retesting a dependency in isolation, and trivial success checks
  are not acceptance evidence.
- RED → GREEN → REFACTOR. Tests first.
- Golden fixtures from reference implementations (Optuna, DSPy).
- Fixture generation uses `uv run` — never `python3` directly.
- Property-based tests run through `it.effect.prop` from `@effect/vitest`, with arbitraries from `effect`'s `FastCheck` re-export; the repo carries no direct `fast-check` dependency.
- Tolerances: exact for integers/categories; mixed absolute + relative for continuous math.

---

## Deployment (Cloudflare Workers)

The `apps/theoria` site deploys as one Cloudflare Worker (`apps/theoria/worker.ts`) that serves the API, the HTML shell, and the built `dist/` bundle as static assets. Configuration lives in `apps/theoria/wrangler.jsonc`; the full runbook is `apps/theoria/DEPLOYMENT.md`.

### Targets

| Target     | Worker            | Hostname                                 | Deployed by                                                   |
| ---------- | ----------------- | ---------------------------------------- | ------------------------------------------------------------- |
| preview    | `theoria-pr-<N>`  | `theoria-pr-<N>.staging.scenesystems.io` | `Theoria Preview` (`workflow_run` on `main`) per pull request |
| staging    | `theoria-staging` | `theoria.staging.scenesystems.io`        | `Theoria` on every push to `main`                             |
| production | `theoria`         | `theoria.scenesystems.io`                | `Theoria` after staging passes and `production` is approved   |

The build runs once per commit (`build:web`, `deploy:dry-run`, `test:worker`) and the same artifact is checked (`theoria-build-check` runs `apps/theoria/scripts/check-build-output.ts`: every `dist/` file must have a content type in `app/server/config/static-store.ts`, the single MIME table the Bun server also uses), deployed, and verified (`theoria-verify-deployment`) at each stage. Only `theoria.scenesystems.io` is indexable; every other hostname gets `X-Robots-Tag: noindex`.

### Deployment Protocol

1. **Code changes** deploy by merging to `main`: staging deploys automatically, production waits for approval of the `production` environment in the workflow run.
2. **Variables** are declared in `wrangler.jsonc` (`vars`) or passed as `--var` by the workflow (`BUILD_SHA`). Changing one is a code change.
3. **Secrets** live in the GitHub `staging` and `production` environments (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); the app itself needs none.
4. **Debugging** starts with the failed workflow step, then `wrangler tail theoria` / `wrangler tail theoria-staging` (Workers Logs are enabled in `wrangler.jsonc`).
5. **Verification** is the `theoria-verify-deployment` checklist: `/api/health/live` reports the deployed `buildSha`, the shell and docs routes answer, `POST /api/imagined-place/build` succeeds, and the indexing header matches the target.

### Anti-patterns

- Editing `run_worker_first` in `wrangler.jsonc` without adding the matching `Match` arm in `app/server/router.ts` (or vice versa); `test/worker/site.test.ts` checks the routing through the real bundle.
- Using `node:fs`/`node:path` or `process.env` in server code — the same code runs in workerd. Use `Config`, `StaticStore`, and `@effect/platform` services.
- Running `wrangler deploy` by hand against production; the workflow is the release path.

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
