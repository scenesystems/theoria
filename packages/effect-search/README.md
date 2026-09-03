# @scenesystems/effect-search

`@scenesystems/effect-search` is black-box optimization for programs built with [Effect](https://effect.website). Use it when you can evaluate a configuration but cannot express its quality as a closed-form or differentiable function: benchmark scores, model quality, operating cost, or the outcome of an experiment.

A `SearchSpace` describes the valid configurations and infers their TypeScript type. A `Study` asks a `Sampler` for a configuration, runs your Effect objective, records the resulting `Trial`, and returns that history to the sampler before its next suggestion. Because the study owns trial states, sampler checkpoints, and search-space identity, an optimization can be inspected, snapshotted, and resumed.

The samplers compute with [`@scenesystems/effect-math`](../effect-math/README.md). Cached objective inputs and study artifacts get stable content identities from [`@scenesystems/digest`](../digest/README.md). [`@scenesystems/effect-dsp`](../effect-dsp/README.md) builds its prompt optimizers on this package.

## Installation

```sh
npm install @scenesystems/effect-search effect @effect/platform @effect/experimental
```

Effect `^3.22.1` is a required peer dependency, together with `@effect/platform` and `@effect/experimental`. `@effect/sql` is an optional peer that is needed only for the SQL-backed cache layers.

## Basic use

The study below minimizes a two-dimensional function. `SearchSpace.make` validates the definition and carries the inferred configuration type through the objective and the result.

```ts typecheck
import { Effect, Match } from "effect"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: ({ x, y }) => Effect.succeed((x - 2) ** 2 + (y + 1) ** 2),
    trials: 50
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) =>
      Effect.log("Best trial", { value: bestTrial.state.value, config: bestTrial.config })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})
```

The objective is an ordinary Effect, so it can use services, fail with typed errors, and run concurrently. Each trial records its configuration and a lifecycle state: running, completed, failed, pruned, or cancelled. The result is a tagged union because the same study machinery returns a Pareto front when there are several objectives.

## Search spaces

A space is a record of dimensions. `SearchSpace.float` takes bounds, an optional `step`, and an optional `scale: "log"` for parameters that vary over orders of magnitude. `SearchSpace.int` takes bounds and an optional `step`. `SearchSpace.categorical` takes a list of literals, `SearchSpace.boolean` is a two-value shortcut, and `SearchSpace.fidelity` marks the budget dimension that HyperBand and BOHB schedule over.

Conditional spaces branch on a categorical value. `SearchSpace.makeConditional` combines shared dimensions with a `SearchSpace.switch` over `SearchSpace.when` branches, and the inferred type is a discriminated union that `Match` can exhaust.

```ts typecheck
import { Effect, Match } from "effect"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const linear = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    regularization: SearchSpace.float(0, 1)
  })
  const tree = yield* SearchSpace.make({
    maxDepth: SearchSpace.int(2, 12),
    minSamplesLeaf: SearchSpace.int(1, 6)
  })
  const space = yield* SearchSpace.makeConditional(
    { model: SearchSpace.categorical(["linear", "tree"]) },
    SearchSpace.switch("model", [SearchSpace.when("linear", linear), SearchSpace.when("tree", tree)])
  )

  return yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 17 }),
    trials: 45,
    objective: (config) =>
      Match.value(config).pipe(
        Match.when({ model: "linear" }, ({ learningRate }) => Effect.succeed(Math.log10(learningRate) ** 2)),
        Match.when({ model: "tree" }, ({ maxDepth }) => Effect.succeed(((maxDepth - 7) / 7) ** 2)),
        Match.exhaustive
      )
  })
})
```

`SearchSpace.Type<typeof space>` names the configuration type when you need it outside the study. `SearchSpace.extend` composes an existing space with additional dimensions.

## Samplers and schedulers

| Constructor             | Suitable space                           | Use it for                                               |
| ----------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `Sampler.random()`      | Any, including conditional               | Baselines, broad exploration, and cheap objectives       |
| `Sampler.grid()`        | Small finite spaces                      | Exhaustive enumeration                                   |
| `Sampler.tpe()`         | Mixed, categorical, or conditional       | Sequential model-guided search; also multi-objective TPE |
| `Sampler.cmaEs()`       | Continuous and integer, single objective | Evolutionary search and local refinement                 |
| `Sampler.gpBo()`        | Continuous and integer, single objective | Gaussian-process Bayesian optimization                   |
| `Scheduler.hyperband()` | Spaces with a fidelity dimension         | Successive halving across budgets                        |
| `Scheduler.bohb()`      | Spaces with a fidelity dimension         | HyperBand allocation with TPE suggestions                |

Start with TPE for mixed spaces and compare it against random search on the same objective and budget. Use grid search only when the finite product is small enough to enumerate. CMA-ES and GP-BO reject categorical dimensions. HyperBand and BOHB require a `SearchSpace.fidelity` dimension and are passed to `Study.optimize` as the `scheduler` option in place of a `sampler`.

A seeded sampler reproduces its suggestions when it sees the same ordered trial history and a compatible checkpoint. The study as a whole is reproducible only if the objective, clock, external services, and observation order are too. Concurrent evaluation can change completion order, so a seed alone does not guarantee identical results under every concurrency setting.

## Running studies

`Study.minimize` and `Study.maximize` run a single-objective study to completion. `Study.optimize` takes an explicit `direction` or a `directions` array and accepts a `scheduler`. All three share the same options:

- Stopping: `trials`, `maxDuration`, `maxCost`, `targetValue`, or `noImprovementWindow`, combined by `stopMode`.
- Concurrency: `concurrency` runs trials in parallel while the sampler keeps suggesting from imputed pending results.
- Robustness: `trialTimeout`, a `retrySchedule`, and a `pruningPolicy`.
- Warm starts: `priorTrials` and `priorWeight` seed the history; `evaluationsPerTrial` averages noisy objectives.

With several `directions`, the objective returns a vector and the result is `MultiObjective` with a `paretoFront`. The `Pareto` module provides dominance checks, front extraction, and two-dimensional hypervolume for comparing runs.

```ts typecheck
import { Effect, Match } from "effect"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    replicas: SearchSpace.int(1, 8),
    cacheMb: SearchSpace.int(64, 1024, { step: 64 })
  })

  const result = yield* Study.optimize({
    space,
    sampler: Sampler.tpe({ seed: 919 }),
    directions: ["minimize", "minimize"],
    trials: 40,
    objective: ({ replicas, cacheMb }) => {
      const latency = 100 / replicas + 2000 / cacheMb
      const cost = replicas * 1.5 + cacheMb / 256
      return Effect.succeed([latency, cost])
    }
  })

  return Match.value(result).pipe(
    Match.tag("MultiObjective", ({ paretoFront }) => paretoFront.length),
    Match.tag("SingleObjective", () => 1),
    Match.exhaustive
  )
})
```

`Study.optimizeStream` runs the same study but emits typed `StudyEvent` values for every trial and study lifecycle change. Fold, filter, or publish the stream with ordinary `Stream` operators; `Study.tapTerminalProgress()` is a ready-made progress sink.

## Persistence and resumption

`Study.snapshot` captures the trials, the next trial number, the sampler checkpoint, and compatibility metadata from a result or an open handle. `Study.StudySnapshot` is a Schema, so encode it for storage and decode it later. `Study.resume` validates the space and settings against the snapshot before continuing.

```ts typecheck
import { Effect, Schema } from "effect"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({ x: SearchSpace.float(-5, 5) })
  const objective = ({ x }: SearchSpace.Type<typeof space>) => Effect.succeed((x - 1.25) ** 2)

  const firstLeg = yield* Study.minimize({ space, sampler: Sampler.tpe({ seed: 404 }), trials: 20, objective })
  const stored = yield* Schema.encode(Study.StudySnapshot)(yield* Study.snapshot(firstLeg))

  const snapshot = yield* Schema.decode(Study.StudySnapshot)(stored)
  return yield* Study.resume({
    space,
    sampler: Sampler.tpe({ seed: 404 }),
    snapshot,
    direction: "minimize",
    trials: 20,
    objective
  })
})
```

For long-running work, `Study.StudyStorageLive` keeps an append-only trial log with atomic snapshots in a directory you choose, and `Study.resumeFromStorage` or `Study.resumeFromStorageStream` continue from it. Storage needs the platform `FileSystem` service, which `@effect/platform-bun` or `@effect/platform-node` provide.

Objective caching is a separate concern. A cache avoids re-running the objective for an input that was already evaluated, keyed by a content digest of that input, while storage preserves the study lifecycle. `Cache.SchemaCacheMemory`, `Cache.SchemaCacheFileSystem`, and `Cache.SchemaCacheSql` provide the backends; `Study.StudyObjectiveCacheMemory`, `Study.StudyObjectiveCacheFileSystem`, and `Study.StudyObjectiveCacheSql` wire them to studies.

## Ask and tell

When another process owns evaluation, such as a job queue or a remote worker, the study can hand out configurations instead of running the objective itself. `Study.open` creates a scoped handle. `Study.ask` reserves the next typed configuration, and `Study.tell`, `Study.fail`, or `Study.cancel` completes that reservation. The handle remains the authority for trial numbers, sampler observations, events, snapshots, and the final `Study.result`.

```ts typecheck
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const evaluateRemotely = (config: { readonly x: number }) => Effect.succeed(config.x ** 2)

export const program = Effect.scoped(
  Effect.gen(function* () {
    const space = yield* SearchSpace.make({ x: SearchSpace.float(-4, 4) })
    const handle = yield* Study.open({
      space,
      sampler: Sampler.random({ seed: 25 }),
      direction: "minimize",
      trials: 4,
      objective: evaluateRemotely
    })

    const asked = yield* Study.ask(handle)
    const value = yield* evaluateRemotely(asked.config)
    yield* Study.tell(handle, asked.trialNumber, value)

    return yield* Study.result(handle)
  })
)
```

## Public surface

Every module is available as a namespace from the package root and as a subpath such as `@scenesystems/effect-search/Study`.

| Module                                        | Scope                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`SearchSpace`](./src/SearchSpace/index.ts)   | Dimensions, conditional branches, composition, validation, and inferred configuration types   |
| [`Study`](./src/Study/index.ts)               | Optimization, ask/tell handles, snapshots, storage, objective caching, streaming, and results |
| [`Sampler`](./src/Sampler/index.ts)           | Sampler constructors, options, checkpoints, and the sampler extension contract                |
| [`Scheduler`](./src/Scheduler/index.ts)       | HyperBand and BOHB plans                                                                      |
| [`Trial`](./src/Trial/index.ts)               | Trial records and lifecycle states                                                            |
| [`StudyEvent`](./src/StudyEvent/index.ts)     | Typed lifecycle events emitted by streaming studies                                           |
| [`Pareto`](./src/Pareto/index.ts)             | Dominance, fronts, weights, and two-dimensional hypervolume                                   |
| [`Cache`](./src/Cache/index.ts)               | Schema-aware cache descriptors with memory, file-system, and SQL layers                       |
| [`Contracts`](./src/contracts/index.ts)       | Shared schemas, identities, and objective contracts                                           |
| [`Errors`](./src/Errors/index.ts)             | Typed errors for spaces, studies, samplers, and trials                                        |
| [`Experimental`](./src/experimental/index.ts) | Unstable APIs that may change outside semver guarantees                                       |

Paths under `internal` are not exported.

## Errors and boundaries

Failures surface in the Effect error channel as `Schema.TaggedError` values, so `Effect.catchTag` and `Effect.catchTags` work on them directly. `InvalidSearchSpace` and `InvalidStudyConfig` reject definitions before any trial runs. `InvalidSamplerConfig`, `SamplerSearchSpaceUnsupported`, and `SamplerObjectiveUnsupported` report a sampler that cannot serve the space or the objective shape. `TrialError` wraps an objective failure with its trial number, `NoSuccessfulTrials` means a completed study has no best trial to report, and `SamplerExhausted` means a finite sampler has nothing left to suggest.

The package owns the search loop and its state. It does not own the objective's resources, retries beyond the schedule you pass, or the durability of the directory or database behind storage and caches. Reproducibility of the objective itself remains your responsibility.

## Examples

The [examples directory](./examples/) contains one runnable program per capability. Start with the [quick start](./examples/01-quick-start.ts), then follow the topic you need: [conditional spaces](./examples/07-conditional-spaces.ts) and [space composition](./examples/18-space-composition.ts); [multi-objective optimization](./examples/04-multi-objective.ts), [constrained optimization](./examples/15-constrained-optimization.ts), and [HyperBand and BOHB](./examples/14-hyperband-bohb.ts); [snapshot resume](./examples/10-snapshot-resume.ts), [storage resume](./examples/11-storage-resume.ts), and [trial caching](./examples/12-trial-cache.ts); [ask and tell](./examples/25-ask-tell.ts), [streaming events](./examples/03-streaming-events.ts), and [parallel evaluation](./examples/21-parallel-evaluation.ts); [sampler comparison](./examples/06-sampler-comparison.ts) and [acquisition strategies](./examples/26-acquisition-strategies.ts).

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading. The `Experimental` module may change or be removed with less migration support than the other modules.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

The sampler behavior and numerical fixtures draw on ideas and reference results from [Optuna](https://optuna.org/), including TPE, multi-objective TPE, and study orchestration. Optuna is distributed under the [MIT License](https://github.com/optuna/optuna/blob/master/LICENSE).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
