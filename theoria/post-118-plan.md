# Theoria: dependency-first Effect v4 migration

Status: revised 2026-10-02 following the owner's clarification. This supersedes the earlier PR-0 through PR-6 sequence.

Traceability: [original planning thread](https://ampcode.com/threads/T-01a0f799-f072-75e9-880e-90f41bc95bce), [owner's correction](https://ampcode.com/threads/T-45770919-fa25-4a3e-86be-1c62a54891ba).

## One migration PR, granular commits

**Decided:** use `refactor/effect-v4` for one full migration PR. The first implementation commit upgrades the dependencies. All subsequent work targets v4. There is no preliminary tooling PR, no v3 correctness-salvage phase, and no requirement to make an intermediate v3 state green.

Commit boundaries make the migration reviewable; they are not independently releasable stages. Intermediate commits may be red while their consumers are being migrated. The final head must pass the complete acceptance suite. Do not co-install v3 and v4, add compatibility shims to preserve v3 APIs, or weaken policy to get through the transition.

The migration includes dependency/toolchain upgrades, source and test migration, the agreed `@theoria/*@0.1.0` rename/reset, documentation and enforcement updates, and final correctness/performance verification. Historical optimization work does not dictate the implementation or delay the dependency upgrade.

### Where the referenced history lives

| What                                                                     | Ref                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Pre-integration `main` (performance reference point)                     | `498e253f`, ancestor of `main`                                               |
| Integration-only baseline                                                | `7a1cbd55`, ancestor of `e206de80`                                           |
| PR #117 head: remote performance and policy commits `97c76143..e206de80` | branch `refactor/integration` (= `refs/pull/117/head`)                       |
| 48 local performance commits beyond #117 (`e206de80..bfa7fa56`)          | tag `archive/pr117-performance-bfa7fa56`; branch `archive/pr117-performance` |
| Closure checklist and matrix recorded against `bfa7fa56`                 | `theoria/reference/` on branch `archive/pr117-performance` (head `d21c1047`) |
| Integration candidate `9125fe44` and reviewed #118 head `c8eb18ee`       | `refs/pull/118/head` (squash-merged as `e93d2f9d`)                           |

Every short hash in this document resolves after `git fetch origin --tags`. Archive refs are reference material, never merge candidates.

## Source of truth

Follow upstream's [MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md) and its linked guides, checked against the exact installed/vendored release:

- Import/API rename maps and package consolidation.
- Services: `Context.Tag` / `Effect.Tag` / `Effect.Service` to `Context.Service`, with explicit layers.
- Flattened Cause, error-handling combinator renames, and Exit matching.
- Forking options, Yieldable, and fiber keep-alive/process lifetime.
- Layer memoization across `Effect.provide` calls.
- `FiberRef` to `Context.Reference`, removal of `Runtime<R>`, and Scope changes.
- Equality and the full Schema migration guide.

Upstream now versions the runtime ecosystem packages together. Remaining platform, SQL driver, AI provider, atom framework, OpenTelemetry, and Vitest integrations must match the selected Effect v4 release. Separately versioned development tools must satisfy their own compatibility requirements.

Consolidated modules use paths such as `effect/http`, `effect/ai`, and `effect/reactivity`, not `effect/unstable/*`. Moving paths does not stabilize APIs: review `@stability unstable` and `@stability experimental` annotations when selecting dependency ranges. The earlier plan selected 4.0.0; verify package availability and peer requirements when implementing the dependency commit rather than treating the historical version inventory as a substitute for resolution.

## Granular implementation commit sequence

These are ordered work units in the same PR. Split large package units into coherent commits when needed; do not turn them into preliminary PRs.

Migrate to v4 under the current package names and versions first. After source migration, get typechecking, lint, tests, and builds green before the rename/reset. Renaming remains in this same PR, followed by release metadata and the full acceptance suite against the final names and versions.

The first unit includes foundational configuration and its runtime helpers: the Husky pre-commit implementation, Vite/Vitest configuration, and Worker test sequencing. These must load and execute on v4 now, rather than waiting for the later scripts pass. Preserve the hook's secrets, staged lint/format, and typecheck enforcement; pending application migration may fail those checks, but obsolete tooling imports must not prevent them from running.

1. **Upgrade the full dependency set and toolchain.** Audit root and workspace manifests, select the compatible v4 dependency set, update all required runtime/test/build/lint dependencies together, regenerate `bun.lock`, and sync `.vendor`. Replace consolidated `@effect/platform`, `@effect/experimental`, `@effect/sql`, and `@effect/ai` dependencies with `effect`; remove `@effect/ai-google`; replace `@effect-atom/*` with core reactivity and `@effect/atom-react`. Include the matching platform/AI/SQL integrations, Vitest and coverage 5, `@effect/vitest` 4, and direct `fast-check`. Include the planned tsgo/oxlint/type-aware integration and compatible Wrangler, Node types, and Changesets updates here, not on v3. The prior candidates were `@effect/tsgo` 0.47.2, oxlint 1.86.0, and `oxlint-tsgolint` 7.0.2003; confirm compatibility. Configure `effect-tsgo patch --oxlint`, the strict preset, and type-aware linting; keep tsconfig plugin diagnostics disabled so Effect diagnostics run once through lint. Keep dprint and existing ESLint enforcement. Successful dependency resolution is the first milestone; source compilation is expected to break until subsequent commits.
2. **Migrate digest.** Establish v4 Schema and encoding patterns; preserve canonicalization and byte-identical golden fixtures. Migrate its tests alongside the implementation.
3. **Migrate sign.** Update services, schemas, typed failures, examples, benchmarks, and packed-consumer checks against v4 peers. Fix issues demonstrated on v4, not by importing an old v3 patch queue.
4. **Migrate seal.** Preserve authenticated-encryption representations, failure behavior, service boundaries, and fixtures.
5. **Migrate effect-math.** Update Schema, Result/public APIs, numerical tests, property tests, examples, fixture tooling, and API documentation. Preserve numerical and tail correctness against independent parity fixtures; derive any fixes on v4. Math benchmark tooling and measurements are deferred to step 17, per the owner's instruction; they do not block this package migration.
6. **Migrate effect-study.** Update lifecycle, evaluation, events, persistence, and service/layer composition, including scope and interruption behavior.
7. **Migrate effect-search.** Update optimization APIs, samplers, pruning, event/snapshot codecs, and Result usage; verify seeded behavior and numerical parity.
8. **Migrate effect-text.** Update its consumers of search/study and v4 APIs; preserve layout and traversal behavior.
9. **Migrate effect-inference and remove native Google support.** Update AI/provider APIs and usage observation. Delete `GoogleUsage.ts`, its export/test, the DSP Google trace case, the dependency, and README observation row. Gemini uses OpenRouter primarily, or OpenAI-compatible integration; observe through `OpenRouterUsage` / `OpenAiUsage`. Google was not a configured app `TextProvider`, so no replacement routing is required.
10. **Migrate effect-dsp.** Update signatures, Payload, predictors, traces, and AI composition. Test schema equivalence across runtime-availability changes; never cache that availability at module construction. Preserve validation and discovery synchronization contracts.
11. **Migrate docs-model.** Update schemas/codecs while preserving encoded documentation fixtures.
12. **Migrate apps/theoria server and Worker.** Update HTTP APIs, request services, rate limiting, static storage, scopes, and runtime boundaries. Explicitly audit Layer memoization for accidental cross-request sharing; use local provision or fresh layers where isolation is required.
13. **Migrate apps/theoria client.** Move atom APIs to core reactivity/framework bindings; verify affected browser behavior and rendered states with the existing browser suite.
14. **Finish repository consumers and policy.** Migrate remaining scripts, examples, README checks, API references, and test configuration. Update AGENTS guidance and ESLint selectors to v4 idioms without reducing enforcement. Re-author relevant held #101 guidance against the completed v4 implementation.
15. **Rename packages and reset versions.** After the v4 source migration and initial green integration checks, rename all nine public packages to `@theoria/<name>@0.1.0`: digest, sign, seal, effect-math, effect-study, effect-search, effect-text, effect-inference, and effect-dsp. Update workspace references, imports, publishing/repository metadata where applicable, release tooling, API-reference tooling, workflows, and docs. Start fresh changelogs and normalize `@since` to `0.1.0`. Change schema identifiers, brands, Context keys, and registered symbols to the new scope, but preserve serialized `_tag` values and algorithm strings. Set versions directly; Changesets cannot express a reset. Finalize release entries next without accidentally bumping the intended first release above `0.1.0`.
16. **Finish release metadata.** Replace obsolete queued changesets with the new-line release descriptions, including the Google removal and public API changes. Verify package versions and the release pipeline produce the intended nine `0.1.0` packages.
17. **Complete v4 integration and performance verification.** Rerun the full exact-head acceptance suite, including packed-consumer checks, against the final package names and versions. Repair failures in their owning modules and record comparable benchmark/browser measurements. Necessary regression fixes belong in granular commits in this same PR; do not require a separate measurement PR before calling the migration verified.

## Cross-cutting migration checks

Apply these within each owning commit, using upstream's guides rather than blind renames:

- Schema unions/tuples take arrays; migrate filter/refinement, transformations, JSON codecs, redacted values, and decoding result APIs with their semantics intact.
- `Either` to `Result`, `Match.either` to `Match.result`, and generator self-binding changes.
- Stream callback APIs, error combinators, Cause/Exit matching, fibers, references, scopes, and runtime entry points.
- `fast-check` plus `effect/Arbitrary`, and the new Effect property-test option shape.
- Structural equality and Layer sharing may change behavior even where code typechecks.

The original v3 census found 1,289 TS/TSX files, including 68 `Context.Tag`, 8 `Effect.Tag`, 5 `Effect.Service`, 133 `Schema.parseJson`, 360 `Either`, 533 `Layer`, 332 platform imports, 213 AI uses, 90 atom uses, and 61 FastCheck uses. These are historical scope indicators, not a completeness check for the finished migration.

## Acceptance on the final migration head

- `bun run check:all`, `bun run lint`, `bun run prettier`, `bun run test`, `bun run build`, `bun run build:check`, `bun run check:readmes`, API-reference validation, and `bun run secrets:check`.
- Zero new suppressions or lowered rule severities; preserve existing Effect-native discipline.
- Sign packed-consumer and fixture checks against v4 peers; digest/sign/seal/docs-model golden fixtures and effect-math SciPy parity; DSP equivalence checks across runtime-availability toggles.
- App deploy dry-run and full Worker/browser suite. Keep the 20-second demo-search deadline and cold-first ordering unchanged. Inspect rendered affected UI states.
- Verify vendored sources match the selected release. Audit manifests/imports for obsolete v3 packages and paths, alongside behavioral testing.
- After the authorized merge/deployment, run staging Worker verification against the same candidate. Publication and production promotion remain separately authorized external actions.

Performance verification is part of this PR: compare pre-integration `498e253f`, integrated v3 `e93d2f9d`, and the final v4 head on the same machine class with sequential runs. Measure initial/story-change settling at 4× CPU slowdown (three runs), the full homepage demo-search Worker test, effect-math benchmarks, Sign RSA, and a browser CPU profile. Prior reference measurements were 12.0–12.5 s / 6.6–6.8 s before integration and 18.0–19.0 s / 12.5–13.4 s on integrated v3. They are not new v4 results. Report one comparison table per workload; preserve the production margin requirement below.

## Historical work is evidence, not a prerequisite queue

Do not salvage v3 fixes before migration. The old tail fix (`7ef91c10`), Sign benchmark fix (`4003ea0d`), fixture formatting (`7cd45aa9`), and packed-dependency fix (`04e01b5c`) are references only. If their underlying issue exists on v4, reproduce it and fix it in the owning migration commit with a behavior test. Do not carry their v3 API choices forward automatically.

The earlier performance inventory remains available for diagnosis after v4 is running:

- Math remote: `97c76143`, `c9d8b11e`, `a02cedfe`, `9c049ebc`, `6ac9f78c`, `11ecd514`, `985bbf18`, `71eb6903`, `8a09a63d`, `e195ac47`, `2ca3ac87`, `17077189`, `1b28b437`, `5276bb2c`, `f345db61`, `5136fcab`, `e206de80`; local `51724a81`…`51bb1720` (13).
- Search: `fef1d2e1`, `73175810`, `1d90fcce`, `d3ec2e9d`; `cadff6e8` may already be superseded. `4cec6ea6` was adapted into main.
- Text: `1742cf0e`, remaining `00c4e8b8` hunks (cursor fixes already landed), `e942a636`, `63789522`, `3ae95fcd`; local `2f50a898`, `02975668`, `159d6d49`, `1042f0a3`.
- App: `a5842c76`; Seal: `ed03ecbc`, `9a0b22a8`; Sign: `a747a295`.
- Measurement: `0880a95c` may inform a v4-compatible harness without changing production tests.
- Enforcement intent: `af338e10`, `4f639f81`, `e7723da5`; their old test-harness rewrites are superseded.
- Do not carry the local DSP series `04522d4b`…`bfa7fa56` (23 commits). `9857d418` froze runtime-dependent equivalence availability; validation skips and discovery-lock avoidance also require fresh semantic review. Drop `8c7dbf34`; do not automatically carry `b50fb180`.

Preserve all historical refs. Optional optimization beyond demonstrated migration regressions is not a prerequisite for this PR. No separate package-performance PR series is prescribed by this plan.

## Linter replacement is not a migration prerequisite

Upgrade the lint dependencies first and adapt enforcement to v4 in this PR. A wholesale ESLint-to-oxlint JS plugin port is separate from upgrading those dependencies and is not required to start or finish the migration. Keep ESLint and the Babel parser unless fixture-corpus testing proves replacement enforcement equal or stricter; JS plugin typing and `noInlineConfig` parity remain concerns. Keep dprint. Do not retain the old PR-6 as a required delivery stage.

## Preserved housekeeping and release decisions

- Baseline: PR #118 at `e93d2f9d`; the original plan records green CI and staging deployment, with production still pre-integration. This is historical deployment evidence, not a fresh status query.
- #105 and #111–#116 were closed as superseded; keep their branches and closed #117's history. #109 stays open/unmerged; there is no intermediate v3 release. Hold #101 for v4-aware guidance. Ignore existing Dependabot PRs and take dependency upgrades directly in the first implementation commit. No dependency-cooldown policy.
- First publication after the migration is all nine `@theoria/*@0.1.0` packages. The retained release plan calls for one-time token-based bootstrap from packed tarballs, then per-package trusted-publisher configuration and the existing publish workflow. Verify current npm requirements before executing. Deprecate the eight previously published `@scenesystems/*` names with replacement pointers; do not unpublish them.
- Downstream/Eva cuts over separately in one PR: Effect v4, rewritten imports, and pinned `0.1.0` packages. Snapshot prereleases only on request.
- Production goes directly to v4 after the migration is merged and its measurements show demo-search margin comparable to pre-integration on the CI runner class, or the owner explicitly accepts the documented reduced margin. No publish, deprecation, or production promotion is authorized merely by this plan.
