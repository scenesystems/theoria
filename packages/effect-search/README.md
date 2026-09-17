# @scenesystems/effect-search

`@scenesystems/effect-search` is black-box optimization for programs built with [Effect](https://effect.website). Use it when you can evaluate a configuration but cannot express its quality as a closed-form or differentiable function: benchmark scores, model quality, operating cost, or the outcome of an experiment.

A `SearchSpace` describes the valid configurations and infers their TypeScript type. An `Optimization` asks a `Sampler` for a configuration, runs your Effect objective, records the resulting `Trial`, and returns that history to the sampler before its next suggestion. Because the optimization owns trial states, sampler checkpoints, and search-space identity, it can be inspected, snapshotted, and resumed.

The samplers compute with [`@scenesystems/effect-math`](../effect-math/README.md). Cached objective inputs and search artifacts get stable content identities from [`@scenesystems/digest`](../digest/README.md). [`@scenesystems/effect-dsp`](../effect-dsp/README.md) builds its prompt optimizers on this package.

Reusable trial schemas, history, stop controls, event streams, generic schema-parameterized storage, and artifact persistence live in [`@scenesystems/effect-study`](../effect-study/README.md). `effect-search` depends on that lower-level package and specializes it with optimization schemas, checkpoints, and replay policy; `effect-study` does not depend on `effect-search`. Use `effect-study` directly for fixed-input evaluation or non-numeric observations. Sampling, ranking, pruning, and optimization recovery remain `effect-search` responsibilities.

## Installation

```sh
bun add @scenesystems/effect-search effect @effect/platform @effect/experimental
```

Effect `^3.22.1` is a required peer dependency, together with `@effect/platform` and `@effect/experimental`. `@effect/sql` is an optional peer that is needed only for the SQL-backed cache layers.

## Basic use

The optimization below minimizes a two-dimensional function. `SearchSpace.make` validates the definition and carries the inferred configuration type through the objective and the result.

```ts typecheck
import { Effect, Match, Number as Num } from "effect"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const result = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: ({ x, y }) => Effect.succeed(Num.sum(Numeric.pow(Num.subtract(x, 2), 2), Numeric.pow(Num.sum(y, 1), 2))),
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

The objective is an ordinary Effect, so it can use services, fail with typed errors, and run concurrently. Each trial records its configuration and a lifecycle state: running, completed, failed, pruned, or cancelled. The result is a tagged union because the same optimization machinery returns a Pareto front when there are several objectives.

## Search spaces

A space is a record of dimensions. `SearchSpace.float` takes bounds, an optional `step`, and an optional `scale: "log"` for parameters that vary over orders of magnitude. `SearchSpace.int` takes bounds and an optional `step`. `SearchSpace.categorical` takes a list of literals, `SearchSpace.boolean` is a two-value shortcut, and `SearchSpace.fidelity` marks the budget dimension that HyperBand and BOHB schedule over.

Conditional spaces branch on a categorical value. `SearchSpace.makeConditional` combines shared dimensions with a `SearchSpace.switchOn` over a non-empty `Chunk` of `SearchSpace.when` branches, and the inferred type is a discriminated union that `Match` can exhaust.

```ts typecheck
import { Chunk, Effect, Match, Number as Num } from "effect"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

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
    { model: SearchSpace.categorical(Chunk.make("linear", "tree")) },
    SearchSpace.switchOn("model", Chunk.make(SearchSpace.when("linear", linear), SearchSpace.when("tree", tree)))
  )

  return yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({ seed: 17 }),
    trials: 45,
    objective: (config) =>
      Match.value(config).pipe(
        Match.when({ model: "linear" }, ({ learningRate }) =>
          Effect.succeed(Numeric.pow(Numeric.log10(learningRate), 2))
        ),
        Match.when({ model: "tree" }, ({ maxDepth }) =>
          Effect.succeed(Numeric.pow(Num.unsafeDivide(Num.subtract(maxDepth, 7), 7), 2))
        ),
        Match.exhaustive
      )
  })
})
```

`SearchSpace.Type<typeof space>` names the configuration type when you need it outside the optimization. `SearchSpace.extend` composes an existing space with additional dimensions.

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

Start with TPE for mixed spaces and compare it against random search on the same objective and budget. Use grid search only when the finite product is small enough to enumerate. CMA-ES and GP-BO reject categorical dimensions. HyperBand and BOHB require a `SearchSpace.fidelity` dimension and are passed to `Optimization.run` as the `scheduler` option in place of a `sampler`.

Joint categorical TPE supports at most 65,536 combinations across its dimensions. Larger products fail with checked `InvalidSamplerConfig` before the joint domain is allocated. `nEiCandidates` limits candidate draws, not domain size. This limit applies when model-driven joint categorical sampling begins; random startup does not enumerate the domain.

A seeded sampler reproduces its suggestions when it sees the same ordered trial history and a compatible checkpoint. The optimization as a whole is reproducible only if the objective, clock, external services, and observation order are too. Concurrent evaluation can change completion order, so a seed alone does not guarantee identical results under every concurrency setting.

TPE accepts the built-in acquisition names `"ei"`, `"pi"`, and `"thompson"`, or a custom `Acquisition.Acquisition` created with `Acquisition.make`. Use `Acquisition.isAcquisition` when narrowing unknown extension values.

## Running optimizations

`Optimization.minimize` and `Optimization.maximize` run a single-objective optimization to completion. `Optimization.run` takes an explicit `direction` or a `directions` array and accepts a `scheduler`. All three share the same options:

- Stopping: `trials`, `maxDuration`, `maxCost`, `targetValue`, or `noImprovementWindow`, combined by `stopMode`.
- Concurrency: `concurrency` runs trials in parallel while the sampler keeps suggesting from imputed pending results.
- Robustness: `trialTimeout`, a `retrySchedule`, and a `pruningPolicy`.
- Warm starts: `priorTrials` and `priorWeight` seed the history; `evaluationsPerTrial` averages noisy objectives.

With several `directions`, the objective returns a vector and the result is `MultiObjective` with a `paretoFront`. The `Pareto` module provides dominance checks, front extraction, and two-dimensional hypervolume for comparing runs.

`Pruning.threshold` creates the built-in threshold policy. Objective callbacks receive `Pruning.Runtime` as their second argument, with `report`, `heartbeat`, `requestStop`, and scheduled `resource` controls.

```ts typecheck
import { Array as Arr, Effect, Iterable, Match, Number as Num, Tuple } from "effect"
import { type Direction, Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    replicas: SearchSpace.int(1, 8),
    cacheMb: SearchSpace.int(64, 1024, { step: 64 })
  })

  const result = yield* Optimization.run({
    space,
    sampler: Sampler.tpe({ seed: 919 }),
    directions: Arr.replicate<Direction.Direction>("minimize", 2),
    trials: 40,
    objective: ({ replicas, cacheMb }) => {
      const latency = Num.sum(Num.unsafeDivide(100, replicas), Num.unsafeDivide(2000, cacheMb))
      const cost = Num.sum(Num.multiply(replicas, 1.5), Num.unsafeDivide(cacheMb, 256))
      return Effect.succeed(Tuple.make(latency, cost))
    }
  })

  return Match.value(result).pipe(
    Match.tag("MultiObjective", ({ paretoFront }) => Iterable.size(paretoFront)),
    Match.tag("SingleObjective", () => 1),
    Match.exhaustive
  )
})
```

`Optimization.stream` runs the same optimization but emits typed `OptimizationEvent.OptimizationEvent` values for every trial and optimization lifecycle change. Fold, filter, or publish the stream with ordinary `Stream` operators; `Progress.tap()` adds the ready-made terminal progress reporter without changing stream values.

## Persistence and resumption

`Optimization.snapshot` captures the trials, the next trial number, the sampler checkpoint, and compatibility metadata from a result or an open handle. `OptimizationSnapshot.OptimizationSnapshot` is the schema, so encode it for storage and decode it later. `Optimization.resume` validates the space and settings against the snapshot before continuing.

```ts typecheck
import { Effect, Number as Num, Schema } from "effect"
import { Optimization, OptimizationSnapshot, Sampler, SearchSpace } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({ x: SearchSpace.float(-5, 5) })
  const objective = ({ x }: SearchSpace.Type<typeof space>) => {
    const distance = Num.subtract(x, 1.25)
    return Effect.succeed(Num.multiply(distance, distance))
  }

  const firstLeg = yield* Optimization.minimize({ space, sampler: Sampler.tpe({ seed: 404 }), trials: 20, objective })
  const stored = yield* Schema.encode(OptimizationSnapshot.OptimizationSnapshot)(yield* Optimization.snapshot(firstLeg))

  const snapshot = yield* Schema.decode(OptimizationSnapshot.OptimizationSnapshot)(stored)
  return yield* Optimization.resume({
    space,
    sampler: Sampler.tpe({ seed: 404 }),
    snapshot,
    direction: "minimize",
    trials: 20,
    objective
  })
})
```

For long-running work, import `StudyStorage` from `@scenesystems/effect-study/StudyStorage` and install `OptimizationStorage.layerFileSystem(StudyStorage.fileSystemOptions(directory))`. Generic storage owns the JSON-lines journal and defaults to `study-storage.jsonl`; `OptimizationStorage` supplies the optimization trial and snapshot schemas. `Optimization.resumeFromStorage` or `Optimization.resumeFromStorageStream` continue from that state. `OptimizationStorage.makeFileSystem` is the effectful filesystem constructor. `OptimizationStorage.make` is an Effect that specializes an ambient `StudyStorage`, while `OptimizationStorage.layer` provides that ambient specialization as a `Layer`. Filesystem-backed storage also needs the platform `FileSystem` and `Path` services, which `@effect/platform-bun` or `@effect/platform-node` provide. Optimization persistence does not require an artifact sink or artifact context.

Artifacts are independent from checkpoints. Import `ArtifactContext` and `ArtifactSink` from `@scenesystems/effect-study/ArtifactContext` and `@scenesystems/effect-study/ArtifactSink`. `ArtifactContext.Options` takes `packageVersion` and `runId`—not an optimization or study ID. Emit with `sink.emit(schema, artifact)`. For a filesystem sink use `ArtifactSink.layerFileSystem(directory, fileName?)`; `ArtifactSink.makeFileSystem` remains the effectful constructor, while `ArtifactSink.layer` installs an already-created generic sink.

Objective caching is a separate concern. A cache avoids re-running the objective for an input that was already evaluated, keyed by a content digest of that input, while storage preserves the optimization lifecycle. Construct `ObjectiveCache.Options` with a scope and install `ObjectiveCache.layerMemory`, `ObjectiveCache.layerFileSystem`, or `ObjectiveCache.layerSql`. The lower-level `Cache` module owns schema-keyed cache descriptors and backend services; it fingerprints schema-encoded keys with the canonical identity implementation from `@scenesystems/digest`.

## Ask and tell

When another process owns evaluation, such as a job queue or a remote worker, the optimization can hand out configurations instead of running the objective itself. `Optimization.open` creates a scoped handle. `Optimization.ask` reserves the next typed configuration, and `Optimization.tell`, `Optimization.fail`, or `Optimization.cancel` completes that reservation. The handle remains the authority for trial numbers, sampler observations, events, snapshots, and the final `Optimization.result`.

```ts typecheck
import { Effect, Number as Num } from "effect"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

export const program = Effect.scoped(
  Effect.gen(function* () {
    const space = yield* SearchSpace.make({ x: SearchSpace.float(-4, 4) })
    const evaluateRemotely = (config: SearchSpace.Type<typeof space>) =>
      Effect.succeed(Num.multiply(config.x, config.x))
    const handle = yield* Optimization.open({
      space,
      sampler: Sampler.random({ seed: 25 }),
      direction: "minimize",
      trials: 4,
      objective: evaluateRemotely
    })

    yield* Effect.gen(function* () {
      const asked = yield* Optimization.ask(handle)
      const value = yield* evaluateRemotely(asked.config)
      yield* Optimization.tell(handle, asked.trialNumber, value)
    }).pipe(Effect.repeatN(3))

    return yield* Optimization.result(handle)
  })
)
```

## Public surface

Every module is available as a namespace from the package root and as a subpath such as `@scenesystems/effect-search/Optimization`.

| Module                                                  | Scope                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`Acquisition`](./src/Acquisition.ts)                   | Built-in and custom acquisition scoring strategies                              |
| [`Artifact`](./src/Artifact.ts)                         | Search artifact provenance, payloads, and envelopes                             |
| [`Cache`](./src/Cache.ts)                               | Schema-keyed cache descriptors, results, observers, and backend layers          |
| [`Direction`](./src/Direction.ts)                       | Objective comparison polarity                                                   |
| [`Distribution`](./src/Distribution.ts)                 | Sampling distributions and schema annotations                                   |
| [`Objective`](./src/Objective.ts)                       | Objective specifications, scalar/vector values, and normalization               |
| [`ObjectiveCache`](./src/ObjectiveCache.ts)             | Objective caching and memory, filesystem, and SQL layers                        |
| [`Optimization`](./src/Optimization.ts)                 | Execution, streaming, ask/tell coordination, resumption, and results            |
| [`OptimizationEvent`](./src/OptimizationEvent.ts)       | Optimization lifecycle schema, constructors, guards, and matching               |
| [`OptimizationSnapshot`](./src/OptimizationSnapshot.ts) | Snapshot schema, compatibility validation, and recovery                         |
| [`OptimizationStorage`](./src/OptimizationStorage.ts)   | Optimization schemas, checkpoints, and replay over generic study storage        |
| [`Pareto`](./src/Pareto.ts)                             | Dominance, fronts, weights, and two-dimensional hypervolume                     |
| [`Progress`](./src/Progress.ts)                         | Terminal event formatting, sinks, and stream tapping                            |
| [`Pruning`](./src/Pruning.ts)                           | Intermediate reports, objective runtime controls, and pruning policies          |
| [`Sampler`](./src/Sampler.ts)                           | Suggestion strategies, options, extension contract, and checkpoints             |
| [`Scheduler`](./src/Scheduler.ts)                       | HyperBand and BOHB plans and summaries                                          |
| [`SearchError`](./src/SearchError.ts)                   | Typed expected failures for spaces, optimization, samplers, storage, and trials |
| [`SearchSpace`](./src/SearchSpace.ts)                   | Dimensions, conditional branches, composition, and inferred configuration types |
| [`Trial`](./src/Trial.ts)                               | Search trial states, records, guards, and matching                              |

Paths under `internal` are not exported.

## Errors and boundaries

Failures surface in the Effect error channel as `Schema.TaggedError` values, so `Effect.catchTag` and `Effect.catchTags` work on them directly. `InvalidSearchSpace` and `InvalidOptimizationConfig` reject definitions before any trial runs. `InvalidSamplerConfig`, `SamplerSearchSpaceUnsupported`, and `SamplerObjectiveUnsupported` report a sampler that cannot serve the space or the objective shape. `TrialError` wraps an objective failure with its trial number, `NoSuccessfulTrials` means a completed optimization has no best trial to report, and `SamplerExhausted` means a finite sampler has nothing left to suggest.

The package owns the search loop and its state. It does not own the objective's resources, retries beyond the schedule you pass, or the durability of the directory or database behind storage and caches. Reproducibility of the objective itself remains your responsibility.

## Examples

The [examples directory](./examples/) contains one runnable program per capability. Start with the [quick start](./examples/01-quick-start.ts), then follow the topic you need: [conditional spaces](./examples/07-conditional-spaces.ts) and [space composition](./examples/18-space-composition.ts); [multi-objective optimization](./examples/04-multi-objective.ts), [constrained optimization](./examples/15-constrained-optimization.ts), and [HyperBand and BOHB](./examples/14-hyperband-bohb.ts); [snapshot resume](./examples/10-snapshot-resume.ts), [storage resume](./examples/11-storage-resume.ts), and [trial caching](./examples/12-trial-cache.ts); [ask and tell](./examples/25-ask-tell.ts), [streaming events](./examples/03-streaming-events.ts), and [parallel evaluation](./examples/21-parallel-evaluation.ts); [sampler comparison](./examples/06-sampler-comparison.ts) and [acquisition strategies](./examples/26-acquisition-strategies.ts).

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

The sampler behavior and numerical fixtures draw on ideas and reference results from [Optuna](https://optuna.org/), including TPE, multi-objective TPE, and study orchestration. Optuna is distributed under the [MIT License](https://github.com/optuna/optuna/blob/master/LICENSE).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
