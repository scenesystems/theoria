# @scenesystems/effect-search

Black-box optimization for TypeScript programs built with [Effect](https://effect.website). Use it when a configuration can be evaluated but its quality cannot be expressed as a differentiable or closed-form function. Typical objectives include benchmark results, model quality, operating cost, and experiment outcomes.

A typed `SearchSpace` describes valid configurations. A `Study` asks a `Sampler` for a configuration, runs the Effect objective, records the resulting observation, and returns that history to the sampler before later suggestions. The study retains trial states, sampler checkpoints, search-space identity, and sequencing metadata so the optimization can be inspected, snapshotted, and resumed.

[`@scenesystems/effect-math`](../effect-math/README.md) supplies the numerical operations used by the samplers. [`@scenesystems/digest`](../digest/README.md) gives cached inputs and study artifacts stable content identities.

## Installation

```sh
npm install @scenesystems/effect-search effect @effect/platform @effect/experimental
```

The exact peer ranges for version 0.4.1 are:

- `effect`: `^3.22.1`
- `@effect/platform`: `^0.97.1`
- `@effect/experimental`: `^0.61.1`
- `@effect/sql`: `>=0.52.1`, optional and required only for the SQL-backed `SchemaCacheSql` and `StudyObjectiveCacheSql` layers

## Minimal study

This study minimizes a two-dimensional objective. `SearchSpace.make` validates the definition and preserves the inferred configuration type through the objective and result.

```ts typecheck
import { Effect, Match } from "effect"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: (config) => Effect.succeed((config.x - 2) ** 2 + (config.y + 1) ** 2),
    trials: 50
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) =>
      Effect.log("Best trial", {
        value: bestTrial.state.value,
        config: bestTrial.config
      })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

Effect.runPromise(program)
```

An objective may use any services and typed failures supported by Effect. A trial records its configuration and lifecycle state as running, completed, failed, pruned, or cancelled. For multiple objectives, `Study.optimize` accepts `directions` and returns a Pareto front instead of one best trial.

## Sampler selection

| Sampler or scheduler    | Suitable space                           | Use case                                                          |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `Sampler.random()`      | Mixed or conditional                     | Baselines, broad exploration, and inexpensive evaluations         |
| `Sampler.grid()`        | Small finite spaces                      | Exhaustive enumeration                                            |
| `Sampler.tpe()`         | Mixed, categorical, or conditional       | Sequential model-guided search; also supports multi-objective TPE |
| `Sampler.cmaEs()`       | Continuous and integer, single objective | Evolutionary search and local refinement                          |
| `Sampler.gpBo()`        | Continuous and integer, single objective | Surrogate-guided Bayesian optimization                            |
| `Scheduler.hyperband()` | Space with a fidelity dimension          | Successive-halving allocation across budgets                      |
| `Scheduler.bohb()`      | Space with a fidelity dimension          | HyperBand scheduling with TPE-based suggestions                   |

TPE is a practical starting point for mixed spaces. Compare it with random search on the same objective and budget. Grid search is appropriate only when the finite product is tractable. CMA-ES and GP-BO reject categorical dimensions. HyperBand and BOHB require an explicit `SearchSpace.fidelity` dimension.

Seeded samplers reproduce suggestions when they receive the same ordered trial history and compatible checkpoint state. Reproducibility also depends on the objective, clock, external services, scheduling, and observation order. Arbitrary concurrent effects can change completion order and results, so a seed alone does not guarantee identical studies under all concurrency settings.

## Study capabilities

`Study.minimize` and `Study.maximize` cover single-objective runs. `Study.optimize` adds explicit single- or multi-objective directions and scheduler-based plans. Study options include:

- bounded trial count, duration, total reported cost, target value, and no-improvement stopping
- concurrent evaluation with pending-trial imputation
- prior trials for warm starts and re-evaluation support for noisy objectives
- per-trial timeout, Effect schedules for retries, pruning, and early stopping
- conditional and composed spaces containing float, integer, categorical, boolean, and fidelity dimensions
- Pareto-front results and hypervolume utilities for multi-objective work
- objective caches backed by memory, the Effect file-system services, or an optional SQL client

The [examples directory](./examples/) contains focused programs for each option instead of duplicating their setup here.

## Persistence and orchestration

### Snapshots and storage

`Study.snapshot` captures trials, the next trial number, sampler state, and compatibility metadata. Encode and store the snapshot with Effect Schema, then continue with `Study.resume`. Resumption validates the supplied space and study settings against the saved state.

`StudyStorage` provides an append-only trial log with atomic snapshots, along with `resumeFromStorage` and `resumeFromStorageStream`. Applications supply the required platform services and choose the storage location. Objective caching is separate from study persistence: it avoids repeating an evaluation for the same durable input while storage preserves the study lifecycle.

### Ask and tell

`Study.open` creates a scoped study handle. `Study.ask` reserves the next typed configuration for an external worker, and `Study.tell`, `Study.fail`, or `Study.cancel` completes that reservation. The handle remains the authority for trial numbers, sampler observations, events, snapshots, and final results. This protocol fits queues and remote evaluators where `Study.optimize` cannot own execution directly.

### Streaming

`Study.optimizeStream` emits typed `StudyEvent` values for trial and study lifecycle changes. `Study.resumeStream` and `resumeFromStorageStream` provide the corresponding resume paths. Consumers can fold, filter, or publish the stream with standard Effect `Stream` operators without changing optimization semantics.

## Public surface

Imports are available from the package root as namespaces and from the documented subpaths.

| Module                | Scope                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `SearchSpace`         | Dimensions, conditional branches, composition, validation, and inferred configuration types |
| `Study`               | Optimization, ask/tell handles, snapshots, storage, caching, streaming, and result types    |
| `Sampler`             | Sampler constructors, options, checkpoints, and the sampler extension contract              |
| `Scheduler`           | HyperBand and BOHB plans                                                                    |
| `Trial`, `StudyEvent` | Trial state and typed lifecycle events                                                      |
| `Pareto`              | Dominance, fronts, weights, and two-dimensional hypervolume                                 |
| `Cache`               | Schema-aware cache descriptors and memory, file-system, or SQL layers                       |
| `Contracts`, `Errors` | Shared schemas, identities, objective contracts, and typed errors                           |
| `Experimental`        | Unstable APIs described below                                                               |

The export map also provides case-sensitive subpaths such as `@scenesystems/effect-search/Study`. Lowercase `contracts` and `experimental` aliases are retained. Paths under `internal` are blocked from consumers.

## Examples and reference

- [Quick start](./examples/01-quick-start.ts)
- [Conditional spaces](./examples/07-conditional-spaces.ts) and [space composition](./examples/18-space-composition.ts)
- [Snapshot resume](./examples/10-snapshot-resume.ts), [storage resume](./examples/11-storage-resume.ts), and [ask/tell](./examples/25-ask-tell.ts)
- [Streaming events](./examples/03-streaming-events.ts) and [parallel evaluation](./examples/21-parallel-evaluation.ts)
- [Multi-objective optimization](./examples/04-multi-objective.ts), [HyperBand and BOHB](./examples/14-hyperband-bohb.ts), and [constrained optimization](./examples/15-constrained-optimization.ts)
- [Sampler comparison](./examples/06-sampler-comparison.ts) and [acquisition strategies](./examples/26-acquisition-strategies.ts)

See the complete [example index](./examples/). Repository source and issue tracking are on [GitHub](https://github.com/scenesystems/theoria).

## Status and stability

The package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review release notes when upgrading. The `Experimental` namespace is explicitly unstable and includes APIs that may change or be removed with less migration support than the main modules. Fixture-backed tests do not make those APIs stable.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

The sampler behavior and numerical fixtures draw on ideas and reference results from [Optuna](https://optuna.org/), including TPE, multi-objective TPE, and study orchestration concepts. Optuna is distributed under the [MIT License](https://github.com/optuna/optuna/blob/master/LICENSE).

## License

`@scenesystems/effect-search` is released under the [MIT License](./LICENSE). Copyright 2026 Scene Systems.
