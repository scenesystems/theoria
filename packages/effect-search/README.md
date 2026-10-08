# @scenesystems/effect-search

Search finds configurations by evaluating them in [Effect](https://effect.website). It is useful when a measurement, such as a benchmark score or operating cost, is easier to obtain than a formula you can minimize directly.

Define the valid configurations with `SearchSpace` and supply an Effect that measures each one. `Optimization` asks a sampler for configurations and returns the recorded trials to it for subsequent suggestions. You can inspect a run, save a snapshot, and resume it later. For prompt optimization built on Search, see [`effect-dsp`](../effect-dsp/README.md).

For fixed-input evaluation or non-numeric observations without search, use
[`@scenesystems/effect-study`](../effect-study/README.md) directly.

## Installation

```sh
bun add @scenesystems/effect-search effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/effect-search/Optimization`.

Filesystem persistence also requires `@effect/platform-bun` or `@effect/platform-node`. Install an Effect SQL implementation when using the SQL-backed cache layer.

## Basic use

Minimize a two-dimensional function. `SearchSpace.make` validates the definition and infers the configuration type used by the objective and result.

```ts typecheck
import { Effect, Match, Number as Num } from "effect"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const result = yield* Optimization.minimize(
    new Optimization.FlatOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 42 })),
      objective: ({ x, y }) =>
        Effect.succeed(Num.sum(Numeric.pow(Num.subtract(x, 2), 2), Numeric.pow(Num.sum(y, 1), 2))),
      trials: 50
    })
  )

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

A space is a record of dimensions. `SearchSpace.float` takes bounds, an optional `step`, and an optional `scale: "log"` for parameters that vary over orders of magnitude. `SearchSpace.int` takes bounds and an optional `step`. `SearchSpace.categorical` takes a readonly array of literals, `SearchSpace.boolean` is a two-value shortcut, and `SearchSpace.fidelity` marks the budget dimension that HyperBand and BOHB schedule over.

Conditional spaces branch on a categorical value. `SearchSpace.makeConditional` combines shared dimensions with a `SearchSpace.switchOn` over a non-empty `Chunk` of `SearchSpace.when` branches, and the inferred type is a discriminated union that `Match` can exhaust.

```ts typecheck
import { Chunk, Effect, Match, Number as Num, Tuple } from "effect"
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
    { model: SearchSpace.categorical(Tuple.make("linear", "tree")) },
    SearchSpace.switchOn("model", Chunk.make(SearchSpace.when("linear", linear), SearchSpace.when("tree", tree)))
  )

  return yield* Optimization.minimize(
    new Optimization.FlatOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 17 })),
      trials: 45,
      objective: (config: SearchSpace.Type<typeof space>) =>
        Match.value(config).pipe(
          Match.when({ model: "linear" }, ({ learningRate }) =>
            Effect.succeed(Numeric.pow(Numeric.log10(learningRate), 2))
          ),
          Match.when({ model: "tree" }, ({ maxDepth }) =>
            Effect.succeed(Numeric.pow(Num.divideUnsafe(Num.subtract(maxDepth, 7), 7), 2))
          ),
          Match.orElseAbsurd
        )
    })
  )
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

Joint categorical TPE supports at most 65,536 combinations across its dimensions. A larger product fails with `InvalidSamplerConfig` when model-driven sampling begins, even if random startup succeeded. Lowering `nEiCandidates` does not reduce the domain size. See [`Sampler`](./src/Sampler.ts) for configuration limits.

A seed reproduces suggestions for the same ordered trial history and compatible checkpoint. Reproducing a whole run also requires repeatable objectives and external services. Timing and concurrent completion order can change the observations presented to the sampler.

Seeded sequences and checkpoints are implementation-dependent. Check the [changelog](./CHANGELOG.md) before resuming a study across upgrades; start a new run when the checkpoint or random sequence is incompatible.

TPE accepts the built-in acquisition names `"ei"`, `"pi"`, and `"thompson"`, or a custom `Acquisition.Acquisition` created with `Acquisition.make`. Use `Acquisition.isAcquisition` when narrowing unknown extension values.

## Running optimizations

`Optimization.minimize` and `Optimization.maximize` run a single-objective optimization to completion. `Optimization.run` takes an explicit `direction` or a `directions` array and accepts a `scheduler`. All three share the same options:

- Stopping: `trials`, `maxDuration`, `maxCost`, `targetValue`, or `noImprovementWindow`, combined by `stopMode`.
- Concurrency: `concurrency` runs trials in parallel while the sampler keeps suggesting from imputed pending results.
- Trial handling: `trialTimeout`, a `retrySchedule`, and a `pruningPolicy`.
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

  const result = yield* Optimization.run(
    new Optimization.FlatOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 919 })),
      directions: Arr.replicate<Direction.Direction>("minimize", 2),
      trials: 40,
      objective: ({ replicas, cacheMb }) => {
        const latency = Num.sum(Num.divideUnsafe(100, replicas), Num.divideUnsafe(2000, cacheMb))
        const cost = Num.sum(Num.multiply(replicas, 1.5), Num.divideUnsafe(cacheMb, 256))
        return Effect.succeed(Tuple.make(latency, cost))
      }
    })
  )

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

Snapshots retain completed observations and their trial numbers. Pending reservations are cancelled on interruption or when restoring an open handle's snapshot; new trials receive new numbers. Restore rejects invalid trial identities and configurations. See [`OptimizationSnapshot`](./src/OptimizationSnapshot.ts) for validation and diagnostic normalization.

```ts typecheck
import { Effect, Number as Num, Schema } from "effect"
import { Optimization, OptimizationSnapshot, Sampler, SearchSpace } from "@scenesystems/effect-search"

export const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({ x: SearchSpace.float(-5, 5) })
  const objective = ({ x }: SearchSpace.Type<typeof space>) => {
    const distance = Num.subtract(x, 1.25)
    return Effect.succeed(Num.multiply(distance, distance))
  }

  const firstLeg = yield* Optimization.minimize(
    new Optimization.FlatOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 404 })),
      trials: 20,
      objective
    })
  )
  const stored = yield* Schema.encodeEffect(OptimizationSnapshot.OptimizationSnapshot)(
    yield* Optimization.snapshot(firstLeg)
  )

  const snapshot = yield* Schema.decodeEffect(OptimizationSnapshot.OptimizationSnapshot)(stored)
  return yield* Optimization.resume(
    new Optimization.ResumeOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 404 })),
      snapshot,
      direction: "minimize",
      trials: 20,
      objective
    })
  )
})
```

For filesystem persistence, import `StudyStorage` from `@scenesystems/effect-study/StudyStorage` and install `OptimizationStorage.layerFileSystem(StudyStorage.fileSystemOptions(directory))`. Provide the platform `FileSystem` and `Path` services through `@effect/platform-bun` or `@effect/platform-node`. Continue with `Optimization.resumeFromStorage` or `Optimization.resumeFromStorageStream`; see the [storage resume example](./examples/11-storage-resume.ts) and [`OptimizationStorage` reference](./src/OptimizationStorage.ts).

Use one storage location per optimization and coordinate which process resumes it. Retain the complete trial log for recovery. Identical append retries are deduplicated; conflicting contents fail.

To emit artifacts independently of checkpoints, use Study's [`ArtifactContext`](../effect-study/src/ArtifactContext.ts) and [`ArtifactSink`](../effect-study/src/ArtifactSink.ts). See [artifact persistence](../effect-study/examples/artifact-persistence.ts) for allocation and delivery.

To reuse an objective's result for an input, construct `new ObjectiveCache.Options({ scope })` and provide `ObjectiveCache.layerMemory`, `ObjectiveCache.layerFileSystem`, or `ObjectiveCache.layerSql`. The cache identifies inputs by their content digest. It does not replace storage of the optimization's history. See [`Cache`](./src/Cache.ts) for custom schema-keyed caches.

When `evaluationsPerTrial` is greater than one, optimization bypasses the objective cache for every sample, including repeated configurations across trials. These independent evaluations produce the reported mean and variance; cached configuration values cannot estimate noise.

## Ask and tell

Use ask-and-tell when a job queue or remote worker evaluates configurations. Open a scoped handle with `Optimization.open`, request a configuration with `ask`, then report its result with `tell` or `fail`. The handle assigns trial numbers and updates the sampler. Closing its scope releases the sampler; `Optimization.cancel` closes the handle and cancels pending reservations. Prior observations do not consume the new run's trial budget.

```ts typecheck
import { Effect, Number as Num } from "effect"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

export const program = Effect.scoped(
  Effect.gen(function* () {
    const space = yield* SearchSpace.make({ x: SearchSpace.float(-4, 4) })
    const evaluateRemotely = (config: SearchSpace.Type<typeof space>) =>
      Effect.succeed(Num.multiply(config.x, config.x))
    const handle = yield* Optimization.open(
      new Optimization.FlatOptions({
        space,
        sampler: Sampler.random({ seed: 25 }),
        direction: "minimize",
        trials: 4,
        objective: evaluateRemotely
      })
    )

    yield* Effect.gen(function* () {
      const asked = yield* Optimization.ask(handle)
      const value = yield* evaluateRemotely(asked.config)
      yield* Optimization.tell(handle, asked.trialNumber, value)
    }).pipe(Effect.repeat({ times: 3 }))

    return yield* Optimization.result(handle)
  })
)
```

## Errors

Failures surface in the Effect error channel as `Schema.TaggedError` values, so `Effect.catchTag` and `Effect.catchTags` work on them directly. `InvalidSearchSpace` and `InvalidOptimizationConfig` reject definitions before any trial runs. `InvalidSamplerConfig`, `SamplerSearchSpaceUnsupported`, and `SamplerObjectiveUnsupported` report a sampler that cannot serve the space or the objective shape. `TrialError` wraps an objective failure with its trial number, `NoSuccessfulTrials` means a completed optimization has no best trial to report, and `SamplerExhausted` means a finite sampler has nothing left to suggest.

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs:

- [Basic optimization](./examples/01-quick-start.ts)
- [Conditional spaces](./examples/07-conditional-spaces.ts) and [space composition](./examples/18-space-composition.ts)
- [Multi-objective optimization](./examples/04-multi-objective.ts) and [constraints](./examples/15-constrained-optimization.ts)
- [HyperBand and BOHB](./examples/14-hyperband-bohb.ts)
- [Snapshot resumption](./examples/10-snapshot-resume.ts) and [storage resumption](./examples/11-storage-resume.ts)
- [Objective caching](./examples/12-trial-cache.ts)
- [Ask and tell](./examples/25-ask-tell.ts)
- [Streaming events](./examples/03-streaming-events.ts) and [parallel evaluation](./examples/21-parallel-evaluation.ts)
- [Sampler comparison](./examples/06-sampler-comparison.ts) and [acquisition strategies](./examples/26-acquisition-strategies.ts)

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## Attribution

The sampler behavior and numerical fixtures draw on ideas and reference results from [Optuna](https://optuna.org/), including TPE, multi-objective TPE, and study orchestration. Optuna is distributed under the [MIT License](https://github.com/optuna/optuna/blob/master/LICENSE).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
