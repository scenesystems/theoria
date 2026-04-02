# effect-search

## 0.2.1

### Patch Changes

- [#21](https://github.com/scenesystems/theoria/pull/21) [`1f68ecc`](https://github.com/scenesystems/theoria/commit/1f68ecc48ba1fc2b272b69a7bfcdefa3d93cf4e5) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Fix stream bridge completion delivery for merged consumers and preserve tail events emitted at stream shutdown boundaries.

## 0.2.0

### Minor Changes

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add advanced continuous samplers to `effect-search` with new `Sampler.cmaEs()` and `Sampler.gpBo()` constructors.

  This release expands sampler taxonomy/checkpoint schemas (`CmaEs` and `GpBo`), adds typed sampler compatibility errors (`SamplerSearchSpaceUnsupported`, `SamplerObjectiveUnsupported`), supports snapshot/resume validation for the new samplers, and ships deterministic fixture-backed + integration coverage for advanced sampler execution.

  Documentation and examples now include advanced-sampler guidance and continuous-space comparison coverage.

### Patch Changes

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Harden advanced sampler determinism and shared SQL cache integration in `effect-search`.
  - preserve GP-BO deterministic replay by consuming seeded RNG draws only for Thompson sampling and by reusing a single Cholesky factor during posterior construction
  - replace the SQLite-runtime-specific `SchemaCacheSqlite` helper with `SchemaCacheSql`, which accepts a caller-provided SQLite-compatible `SqlClient` layer for shared cache storage
  - keep advanced sampler fixture verification wired into the committed Optuna parity suite so cache and sampler regressions are caught together

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Reduce hot-path TPE overhead in `effect-search` so deterministic optimization stays within local test budgets.
  - remove per-candidate Effect wrapper overhead from the univariate float and int TPE trace builders
  - reduce continuous Parzen sampling and density overhead by reusing kernel parameter objects in the hot path
  - route continuous Parzen and multivariate Gaussian log-density aggregation through the shared `effect-math` `logSumExp` authority so the sampler stays aligned to the math source of truth

- Updated dependencies [[`774c14c`](https://github.com/scenesystems/theoria/commit/774c14c0a27d05c01109ac496fd15b9efeb8d922), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`4651634`](https://github.com/scenesystems/theoria/commit/46516347d9c73308cfb7ea65ab98eae77537f3be), [`3c3e316`](https://github.com/scenesystems/theoria/commit/3c3e316dd563bb684338e521e9e0e953b872c329)]:
  - @scenesystems/digest@0.2.0
  - effect-math@0.2.0

## 0.1.3

### Patch Changes

- [#11](https://github.com/scenesystems/theoria/pull/11) [`7de6c02`](https://github.com/scenesystems/theoria/commit/7de6c02e0d65cd66b5d4c2ed1c01a8c7bee6ee01) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - fix: resolve workspace: protocol deps to real semver in dist/package.json at build time

  `build-utils pack-v3` copies `workspace:^` dependencies verbatim into `dist/package.json`,
  and `changeset publish` (which calls `npm publish` internally) does not rewrite them. This
  made published packages uninstallable outside the monorepo.

  Adds `scripts/resolve-workspace-deps.ts` which runs after all per-package builds, reads each
  workspace package's actual version, and rewrites `workspace:^` → `^{version}` (and `~`, `*`
  variants) in every `dist/package.json`. Also supports `--check` mode for CI verification.

## 0.1.2

### Patch Changes

- [#9](https://github.com/scenesystems/theoria/pull/9) [`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - fix: replace workspace:\* with workspace:^ so changesets resolves real version ranges on publish

- Updated dependencies [[`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7)]:
  - effect-math@0.1.2

## 0.1.1

### Patch Changes

- [#7](https://github.com/scenesystems/theoria/pull/7) [`879632d`](https://github.com/scenesystems/theoria/commit/879632dbc69face1471bf9f8e78c68e756dc854c) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Fix LCG attribution (Knuth, not Numerical Recipes), correct broken standalone effect-dsp links to monorepo paths, remove stale monorepo migration TODO, and update publish-readiness script constants to match packages/effect-search layout.

- Updated dependencies [[`2025cab`](https://github.com/scenesystems/theoria/commit/2025cab1ebda57eb22a0637df96cc3b2e9a52dae)]:
  - effect-math@0.1.1

## 0.1.0

### Minor Changes

- [#1](https://github.com/scenesystems/theoria/pull/1) [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `effect-search` — Bayesian optimization for TypeScript, built on Effect.

  ### Search spaces
  - **Typed parameter definitions** — `float`, `int`, `categorical`, `boolean`, and tree-structured conditionals with full type inference
  - **Composable spaces** — build complex hierarchical search spaces with `SearchSpace.unsafeMake` and conditional branching

  ### Samplers
  - **Random** — uniform baseline with deterministic seed control
  - **Grid** — exhaustive search with finite dimension enumeration
  - **TPE** — Tree-structured Parzen Estimator with Expected Improvement, Probability of Improvement, and Thompson sampling acquisition functions
  - **Multivariate TPE** — joint density estimation for correlated parameter spaces via continuous Parzen windows
  - **Constrained TPE** — constraint-aware optimization with feasibility-weighted acquisition
  - **MOTPE** — multi-objective TPE for Pareto-optimal trade-offs with non-dominated sorting

  ### Study orchestration
  - **`Study.optimize`** — single entry point for complete optimization runs with budget, direction, and concurrency control
  - **`Study.optimizeStream`** — streaming variant emitting real-time `StudyEvent` lifecycle events
  - **Snapshot/resume** — serialize study state for persistence and resume optimization across process boundaries
  - **Ask/tell protocol** — manual orchestration for external objective evaluation loops
  - **Warm-starting** — inject trials from prior studies to skip the cold-start phase

  ### Multi-fidelity scheduling
  - **HyperBand** — successive halving with automatic bracket selection for early stopping of unpromising configurations
  - **BOHB** — Bayesian Optimization and HyperBand combining TPE-guided sampling with multi-fidelity evaluation

  ### Pareto utilities
  - **Non-dominated sorting** — epsilon-dominance Pareto front extraction
  - **Hypervolume indicator** — exact hypervolume computation for multi-objective quality assessment
  - **Objective normalization** — direction-aware vector normalization for mixed minimize/maximize objectives

  ### Pruning
  - **Constant-liar imputation** — pending trial handling for parallel optimization with configurable imputation policies
  - **Percentile pruning** — early stopping based on intermediate result comparison against configurable percentile thresholds

  ### Infrastructure
  - **Deterministic seeds** — reproducible optimization runs with xoshiro256++ PRNG
  - **Content-addressed caching** — durable fingerprinting via `@scenesystems/digest` for objective result deduplication
  - **Typed error hierarchy** — `SpaceError`, `SamplerError`, `StudyError`, and `SearchError` union types with `Schema.TaggedError` members in the Effect error channel

  Built entirely on [Effect](https://effect.website) with typed error channels, fiber-safe concurrency, and Schema-driven type inference throughout. Depends on `@scenesystems/digest` for content-addressed caching and `effect-math` for numerical primitives.

### Patch Changes

- Updated dependencies [[`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e), [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e)]:
  - @scenesystems/digest@0.1.0
  - effect-math@0.1.0
