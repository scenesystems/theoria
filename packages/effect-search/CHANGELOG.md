# effect-search

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
