# effect-dsp

## 0.1.2

### Patch Changes

- [#9](https://github.com/scenesystems/theoria/pull/9) [`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - fix: replace workspace:\* with workspace:^ so changesets resolves real version ranges on publish

- Updated dependencies [[`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7)]:
  - effect-search@0.1.2
  - effect-math@0.1.2

## 0.1.1

### Patch Changes

- [#7](https://github.com/scenesystems/theoria/pull/7) [`879632d`](https://github.com/scenesystems/theoria/commit/879632dbc69face1471bf9f8e78c68e756dc854c) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Replace relative ../effect-search links in README with absolute GitHub monorepo URLs so they resolve correctly on npm.

- Updated dependencies [[`2025cab`](https://github.com/scenesystems/theoria/commit/2025cab1ebda57eb22a0637df96cc3b2e9a52dae), [`879632d`](https://github.com/scenesystems/theoria/commit/879632dbc69face1471bf9f8e78c68e756dc854c)]:
  - effect-math@0.1.1
  - effect-search@0.1.1

## 0.1.0

### Minor Changes

- [#1](https://github.com/scenesystems/theoria/pull/1) [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `effect-dsp` — programming, not prompting, language models, with Effect.

  A ground-up Effect-native implementation of the DSPy paradigm for TypeScript. Define typed signatures, compose learnable modules, and optimize prompts with fiber-scoped traces — without leaving the Effect ecosystem.

  ### Signatures
  - **Schema-first I/O contracts** — `Signature.make` defines input and output fields with `Schema.Struct` and description annotations. No string parsing, no parallel type system.
  - **Field metadata derivation** — instructions, field info, and prompt templates derived from schema annotations.

  ### Modules
  - **Predict** — core predictor module with dual output strategy resolution (`text` / `structured` / `auto`) and DSPy-compatible `[[ ## field ## ]]` delimiters.
  - **ChainOfThought** — prepends `reasoning` field to output signature for step-by-step reasoning.
  - **BestOfN** — run module N times with different rollout IDs, return best by reward function.
  - **Refine** — `BestOfN` + automatic feedback generation between attempts.
  - **ReAct** — reasoning + acting agent with tool use via `@effect/ai` toolkits.
  - **Compose** — graph-based sub-module wiring with typed `forward` callbacks and DAG cycle detection.
  - **Discovery** — module registry for collecting sub-module references and learnable parameter surfaces.
  - **Save/Load** — serialize and restore module state for checkpointing.

  ### Optimizers
  - **LabeledFewShot** — attach random labeled demos without model calls.
  - **BootstrapFewShot** — teacher-bootstrapped demonstration generation with threshold filtering and configurable concurrency.
  - **BootstrapRS** — random search over bootstrapped demo candidates via `effect-search` Study orchestration.
  - **Ensemble** — run N programs, aggregate via `majorityVote` or custom reduce function.
  - **MIPROv2** — instruction + demo co-optimization via Bayesian search with `effect-search` TPE. Three-phase pipeline: grounded proposer, Bayesian candidate selection, full evaluation.
  - **GEPA** — reflective prompt evolution via natural-language feedback. Multi-objective Pareto frontier management, merge/subsample operations, and streaming progress events.
  - **effectSearchInterop** — canonical bridge between `effect-dsp` module parameters and `effect-search` black-box optimization. Ask/tell orchestration, typed acquisition selection, Pareto helpers, and progress composition.

  ### Evaluation
  - **Batch evaluation** — `Evaluate.run` for batch scoring against labeled examples with metric composition.
  - **Streaming evaluation** — `Evaluate.stream` for real-time progress events during evaluation.
  - **Report generation** — structured `Report` with per-example results, aggregate scores, and metadata.

  ### Metrics
  - **Built-in scorers** — `exactMatch`, `f1`, `contains`, and custom `fromEffect` metric constructors.
  - **Metric composition** — combine multiple metrics with weighted averaging.

  ### Tracing
  - **Fiber-scoped collection** — `FiberRef`-based trace collection with zero cross-fiber contention.
  - **Token usage accounting** — track input/output/total token counts across LM calls.
  - **Scoped tracing** — `Trace.withTracing` for isolated trace collection within effect scopes.

  ### Caching
  - **Module-level memoization** — `DspCache` service for deterministic LM call replay with composite cache keys.
  - **Rollout partitioning** — fiber-local rollout identity for cache key diversity during `bestOfN` evaluation.
  - **Backend flexibility** — in-memory, file-system, and SQLite backends via `effect-search/Cache` shared authority.

  ### Infrastructure
  - **Typed error hierarchy** — `Schema.TaggedError` classes for every failure domain: `SignatureError`, `ParseOutputError`, `BootstrapFailed`, `EvaluateError`, `GepaError`, and more.
  - **Deterministic seeds** — reproducible optimization runs delegated to `effect-search` deterministic seed contracts.
  - **Artifact provenance** — `ArtifactEnvelope` system for typed provenance wrappers on every optimization artifact, re-exported from `effect-search/Contracts`.
  - **Provider isolation** — sole `@effect/ai` runtime import site in `src/internal/lm.ts` for single-point-of-change LM adapter evolution.

  Built on [Effect](https://effect.website) with `@effect/ai` for language model integration and `effect-search` for optimizer search orchestration. Depends on `@scenesystems/digest` (via `effect-search`) for content-addressed caching.

### Patch Changes

- Updated dependencies [[`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e), [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e), [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e)]:
  - @scenesystems/digest@0.1.0
  - effect-math@0.1.0
  - effect-search@0.1.0
