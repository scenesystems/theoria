# Theoria after PR #118: Effect v4 migration plan

Status: planning document, adopted 2026-10-02. Owner decisions are marked **Decided**.
Evidence labels: _verified_ (checked locally or against the registry/upstream source on 2026-10-02), _historical_ (CI or prior review claims).

Traceability: planning thread https://ampcode.com/threads/T-01a0f799-f072-75e9-880e-90f41bc95bce.

## Starting point (verified)

- `main` = `e93d2f9d` (PR #118): the integration-only baseline `7a1cbd55` plus three integration repairs, two narrow demo-search fixes (batch-local density preparation adapted from `4cec6ea6`; cursor lookups adapted from `00c4e8b8`), and cold-first ordering of the throttled demo-search test. CI on that SHA is green (Check, Security, Theoria incl. staging deploy, API reference, Version Packages). Production promotion is manual and has not happened.
- PR #117 is closed at `e206de80` with its branch intact. The later performance history (remote `97c76143..e206de80` and the preserved local performance branch ending at `bfa7fa56`) is kept as reference material only; see "Commit disposition".
- No release-age or dependency-cooldown policy exists in this repository. **Decided:** do not adopt one.

## Compatibility facts (verified)

- `effect@4.0.0` released 2026-10-01. Lockstep 4.0.0 releases exist for `@effect/platform-bun`, `platform-browser`, `platform-node`, `sql-sqlite-node`, `sql-sqlite-bun`, `atom-react` (peer `react >=19 <20`), `ai-anthropic`, `ai-openai`, `ai-openai-compat`, `ai-openrouter`, `opentelemetry`, and `vitest` (peer `vitest >=5 <6`).
- Folded into `effect` and no longer separate packages: `@effect/platform` core (`effect/http*`), `@effect/experimental`, `@effect/sql` core, `@effect/ai` core, `@effect-atom/*` (`effect/reactivity` + `@effect/atom-react@4`), `effect/FastCheck` (`fast-check` + `effect/Arbitrary`; `@effect/vitest` prop options become `{ arbitrary: { runs } }`).
- `@effect/ai-google` has no v4 release. Upstream `migration/annotations/effect__ai-google.yaml` states it was "removed from v4 with no direct replacement" and recommends a supported v4 provider for Gemini or Google's SDK directly. No v4 port is planned upstream.
- No official codemod exists; the upstream migration annotations are rename maps only.
- `@effect/vitest@0.30.x` (v3 line) peers `effect ^3.22` and `vitest ^3.2`, so vitest 5 cannot land before Effect 4.
- `@effect/tsgo@0.47.2` supports TypeScript 7.0.2 (already in use), oxlint 1.82–1.86, and oxlint-tsgolint 7.0.2001/7.0.2003, and lints v3 code; the toolchain can move first.
- Semantic changes to review by hand: `Context.Tag` / `Effect.Tag` / `Effect.Service` → `Context.Service` (no automatic layer, no `dependencies` option); `Layer` memoization is shared across `Effect.provide` (use `{ local: true }` or `Layer.fresh` for isolation); structural equality is the default; `Cause` flattens to `Fail` / `Die` / `Interrupt`; Schema `Union` / `Tuple` take arrays, `filter` → `check` / `refine`, `transform` → `decodeTo`, `parseJson` → `fromJsonString`, `decode*Either` → `decode*Exit`, `Redacted` → `RedactedFromValue`; `Either` → `Result`; `Stream.async*` → `Stream.callback`; `Match.either` → `Match.result`; `Effect.gen(self)` → `Effect.gen({ self })`.

## Census of affected code (verified, 1289 TS/TSX files)

`Context.Tag` 68, `Effect.Tag` 8, `Effect.Service` 5; `Data.Class` 340, `Data.TaggedError` 49, `Data.struct` 49; `Schema.*` 7708 lines (`Struct` 1482, `Class` 172, `TaggedError` 141, `parseJson` 133, `Union(` 119, `Tuple(` 31, `transform` 26, `filter` 22, `equivalence` 14, `Redacted` 4); `ParseResult` 98; `Either` 360; `Match` 4631; `Stream` 373 (`async` 2); `Cause` 58; `Exit` 152; `FiberRef` 15; `Layer` 533; `Effect.gen` 2855; `Effect.fn` 11; `FastCheck` 61 (`it.effect.prop` 53); `@effect/platform` 332 imports (`platform-bun` 145, `HttpClient` 30 files, `HttpServer` 27, `KeyValueStore` 10, `HttpApp` in `worker.ts`); `@effect/ai` 213 (`ai-google` 9); `@effect-atom` 90; `@effect/sql` 8; `@effect/experimental` 3.

## Sequence

PR-0 → PR-1 → PR-2 → PR-3 → PR-4 → PR-5; PR-6 after PR-3.

### PR-0: Housekeeping (complete)

- **Decided / done:** #105 and #111–#116 closed as superseded by #118 (branches kept; #117 kept closed as reference).
- **Decided:** #109 "Version Packages" stays open and unmerged. The downstream consumer pins the currently published versions; no v3 release is needed. The next publish is the v4 line (see "Release and downstream"). If a v3 hotfix is ever required, cut `release/v3` from `e93d2f9d`.
- **Decided:** #101 (strict Effect / delivery / UI guidance, docs-only) is held open. Its guidance depends on the upgraded toolchain, v4 dependencies, and resulting practices; re-author it after PR-3. It currently conflicts with `main` in `AGENTS.md`, `apps/theoria/app/AGENTS.md`, and `packages/effect-math/AGENTS.md`.
- **Decided:** Dependabot PRs are ignored for now (no merges, no rebases). PR-1 takes the bumps it needs directly; vitest 5 and `@vitest/coverage-v8` 5 land only inside PR-3.
- **Decided:** no production promotion until PR-3 is merged and PR-4 remeasurement is complete; `e93d2f9d` stays staging-only.

### PR-1: Tooling bump on Effect v3 (green standalone)

- `@effect/tsgo` 0.40.0 → 0.47.2; `oxlint` 1.81.0 → 1.86.0; add `oxlint-tsgolint` 7.0.2003 (`@oxlint/plugins` only if a JS plugin is added).
- `prepare` → `husky && effect-tsgo patch --oxlint`; `.oxlintrc.json` extends `@effect/tsgo/oxlint-presets/strict.json` with type-aware linting; keep the tsconfig plugin `"diagnostics": false` so `check` remains a pure typecheck and Effect diagnostics are emitted once via oxlint.
- Fold routine development-dependency bumps (wrangler, `@types/node`, `@changesets/cli`). Keep the ESLint selector policy and dprint.
- Rule: fix findings; never suppress or lower severity. Stack per package if the volume is large.
- Acceptance: `bun run lint` exits 0 with zero new suppressions; Effect diagnostics clean; `bun run check:all`, `bun run test`, `bun run build`; `apps/theoria` Worker suite unchanged.

### PR-2: Correctness-only on Effect v3 (small)

- From `7ef91c10`: tail-preservation hunks and tests (`effect-math` normal and erfinv tails; `Distribution/operations.test.ts`, `Special/inverse-operations.test.ts`). Defer its polynomial-table reuse to PR-5.
- `4003ea0d`: `Schema.omit("sub")` before `extend` in the sign benchmark script.
- `7cd45aa9`: fixture formatting.
- `04e01b5c` (`file:` prefix in sign `check-package.ts`) only if the packed test fails.
- Acceptance: root gates; `sign` `test:packed`; `effect-math` parity fixtures. No performance claims.

### PR-3: Effect v4 migration, package rename, and version reset (one atomic PR)

Why atomic: one `effect` pin, one `bun.lock`, `workspace:^` links. Co-installing v3 and v4 is ruled out.

Commit order:

1. Dependency swap (red by itself): all manifests and peer ranges (`effect ^4.0.0`; drop `@effect/ai`, `@effect/experimental`, `@effect/platform`, `@effect/sql`, `@effect/ai-google`), `vitest` 5 + `@effect/vitest` 4, `fast-check`, `@effect/atom-react` 4, `platform-bun` / `platform-browser` 4, `ai-anthropic` / `ai-openai` / `ai-openrouter` 4, `sql-sqlite-node` 4; regenerate `bun.lock`; sync `.vendor` to 4.0.0.
2. Package rename and version reset (**Decided**): every published package becomes `@theoria/<name>` at version `0.1.0` with a fresh `CHANGELOG.md`. The `@theoria` npm scope is owned by the maintainer; the private packages already use it (`@theoria/docs-model`, `@theoria/theoria-app`). Rationale: there are no external consumers, and npm permanently forbids reusing any version ever published under the old names (`0.1.0` is already used by `digest`, `effect-inference`, `seal`, and `sign`), so a rename is the only path to an honest `0.1.0`. Scope: `package.json` names and versions (and `publishConfig` / `repository.directory` where present), `workspace:^` references, README / docs / example imports (≈618 files), `check:readmes` canonical examples, `scripts/release/{Npm,Candidate,Repository}.ts`, `scripts/api-reference/*` outputs and fixtures, `.github/workflows/check.yml` and `snapshot.yml`, `AGENTS.md` (including its `@since` guidance and identifier prefix `@scenesystems/<package>/<Concern>` → `@theoria/<package>/<Concern>`; serialized `_tag` and algorithm strings are protocol contracts and are not renamed). All `@since` annotations become `0.1.0`. Replace the queued `.changeset/*.md` entries with one `0.1.0` changeset per package; changesets cannot express a reset, so set `0.1.0` directly in each `package.json`. `.changeset/config.json` already has `access: public`.
3. Per-package code migration in dependency order: `digest` → `sign`, `seal`, `effect-math` → `effect-study` → `effect-search` → `effect-text`, `effect-inference` → `effect-dsp` → `docs-model` → `apps/theoria` → scripts, examples, READMEs, API reference → `AGENTS.md` policy wording (`Either` → `Result`, `Context.Service`, concern-owned data types) and ESLint selectors → changesets.

Google provider (**Decided**): drop native Google support, following upstream guidance. Remove `packages/effect-inference/src/GoogleUsage.ts`, its `index.ts` export, `test/GoogleUsage.test.ts`, the Google case in `packages/effect-dsp/test/Trace/provider.test.ts`, the `@effect/ai-google` dependency, and the README usage-observation row. Gemini is reached through `@effect/ai-openrouter` (primary) or `@effect/ai-openai-compat`; `OpenRouterUsage` / `OpenAiUsage` are the observation surfaces. Google was never a configured `TextProvider`, so routing is unchanged. The changeset records the removal.

Manual review, highest risk first: `Layer` memoization in the Worker request path (`apps/theoria/worker.ts`, rate limiting, static asset `KeyValueStore`); 68 `Context.Tag` + 5 `Effect.Service` → `Context.Service` with explicit layers; 133 `parseJson` → `fromJsonString` with byte-identical encoded fixtures for `digest` / `sign` / `seal` / `docs-model`; `Schema.filter` / `transform` / `equivalence` in DSP `Payload` with no construction-time caching of runtime availability; `Redacted` → `RedactedFromValue`; `Either` → `Result` in public `effect-math` / `effect-search` APIs; `Cause` / `Exit` matching; `Stream.async` → `callback`; atom → reactivity (61 files); `HttpClient` / `HttpServer` / `HttpApp` → `effect/http*`; `FastCheck` → `fast-check` with prop options.

Acceptance on the exact head: `bun run check:all`, `bun run lint` (PR-1 configuration), `bun run prettier`, `bun run test`, `bun run build`, `bun run build:check`, `bun run check:readmes`, API reference validation, `bun run secrets:check`; `sign` `test:packed` and fixture checks against v4 peers; `apps/theoria` `deploy:dry-run` plus the full Worker/browser suite (20 s demo-search deadline unchanged, cold-first case recorded); golden fixtures (`digest` / `sign` / `seal` / `docs-model`, `effect-math` SciPy parity) unchanged; DSP equivalence tests across runtime-availability toggles; staging deploy and `test:worker:staging`; `vendor:check` at 4.0.0.

Estimate: 8–15 engineer-days after a 1–2 day spike on `digest` + `sign` + `effect-math`.

### PR-4: Performance remeasurement on v4 (measurement only)

- Same machine class, sequential runs: settle-time probe (CPU slowdown 4×, three runs, initial and story-change settle) and the full `apps/theoria/test/worker/home-demo-search.test.ts` on `498e253f` (pre-integration), `e93d2f9d` (v3 baseline), and the PR-3 head. Reference measurements from the review environment: pre-integration 12.0–12.5 s / 6.6–6.8 s; current `main` 18.0–19.0 s / 12.5–13.4 s; deadline 20 s.
- Package benchmarks cited by the deferred commits (`effect-math` scripts, `sign` RSA benchmark) and a browser CPU profile for attribution.
- Rework `0880a95c` (performance-closure harness) into a committed measurement script compatible with cold-first ordering; no production test changes.
- Output: one table per workload (v3 pre-integration / v3 baseline / v4). Gates PR-5 and production.

### PR-5: Performance series on v4 (after PR-4)

One PR per package, each with before/after numbers from the PR-4 harness; no policy or dependency changes.

- `effect-math`: remote `97c76143`, `c9d8b11e`, `a02cedfe`, `9c049ebc`, `6ac9f78c`, `11ecd514`, `985bbf18`, `71eb6903`, `8a09a63d`, `e195ac47`, `2ca3ac87`, `17077189`, `1b28b437`, `5276bb2c`, `f345db61`, `5136fcab`, `e206de80`; local `51724a81`…`51bb1720` (13). Expect heavy v4 conflicts; treat as design notes and re-implement hotspot by hotspot.
- `effect-search`: `fef1d2e1`, `73175810`, `1d90fcce`, `d3ec2e9d`; local `cadff6e8` (likely superseded; verify). Drop `8c7dbf34`.
- `effect-text`: `1742cf0e`, remaining `00c4e8b8` hunks, `e942a636`, `63789522`, `3ae95fcd`; local `2f50a898`, `02975668`, `159d6d49`, `1042f0a3`.
- `apps/theoria`: `a5842c76`. `seal`: `ed03ecbc`, `9a0b22a8`. `sign`: `a747a295`.
- `effect-dsp` local series `04522d4b`…`bfa7fa56` (23 commits): drop as a series. `9857d418` is a confirmed regression (predictor-bound `Payload.makeEncoder` caching custom `Schema.equivalence` availability at module construction); validation skips and discovery-lock avoidance are policy weakenings; the series is bound to v3 Schema and `@effect/ai`. Re-profile DSP on v4 and open fresh measured PRs.

### PR-6: ESLint → oxlint JS plugin port (after PR-3)

- Port `eslint/effect/*` (builtins, control-flow, design-tokens, errors, types) to an oxlint JS plugin; remove `eslint` and the Babel parser; keep dprint. Fold the enforcement intent of `af338e10` (Effect arithmetic), `4f639f81` (numeric conversion), and `e7723da5` (control flow) in as rules.
- Known gaps: oxlint JS plugins are typeless and have no `noInlineConfig` equivalent. Keep ESLint until the port is proven equal or stricter on a fixture corpus.
- Re-author #101 here or alongside PR-3's `AGENTS.md` commit.

## Commit disposition

- Retain now (PR-2): `7ef91c10` tail hunks, `4003ea0d`, `7cd45aa9`, `04e01b5c` optional.
- Superseded by `main`: `4cec6ea6`, `00c4e8b8` cursor hunks, `cadff6e8` (verify), and the test-harness rewrites in `af338e10` / `4f639f81` / `e7723da5`.
- Rework: `0880a95c` (PR-4 harness); lint-enforcement parts of `af338e10` / `4f639f81` / `e7723da5` (PR-1 / PR-6).
- Defer to PR-5: all other remote performance commits and the non-DSP local performance commits.
- Drop: `9857d418`, `8c7dbf34`, `b50fb180` (re-evaluate), the local `effect-dsp` series `04522d4b`…`bfa7fa56`.
- All existing refs stay intact.

## Release and downstream

- Now: no publish, no production promotion. #109 stays open; the downstream consumer stays on the currently published `@scenesystems/*` v3 versions; `e93d2f9d` stays on staging only.
- After PR-3: the first publish is `@theoria/*@0.1.0` for all nine public packages. `publish.yml` uses npm Trusted Publishing, which cannot create new packages, so each new package gets a one-time token-based bootstrap publish (locally from the packed tarballs, or via a temporary granular token), after which the GitHub Actions trusted publisher is added on each package and the existing workflow resumes. Then `npm deprecate @scenesystems/<name>` for the eight old packages with a pointer to the new names (not unpublished; old versions stay installable until downstream cuts over).
- Downstream cutover is a single PR: Effect v4, import rewrite `@scenesystems/*` → `@theoria/*`, pin `0.1.0`. Snapshot prereleases only on request.
- First production promotion happens after PR-3 is merged, gated on PR-4 showing demo-search margin comparable to pre-integration on the CI runner class, or an explicit decision to accept the documented margin. Production goes directly from the current pre-integration deployment to v4.

## Decisions log

2026-10-02: drop native Google (use upstream's documented v4 alternatives); do not merge #109; close #105 and #111–#116; hold #101 until after v4; ignore Dependabot PRs; no release-age policy; no production promotion until the full v4 migration is done; rename all published packages to `@theoria/<name>` at `0.1.0` inside the v4 PR, bootstrap-publish with a token then re-enable trusted publishing, deprecate the eight `@scenesystems/*` packages; downstream rewrites imports in its v4 cutover PR.

Open decisions: none.
