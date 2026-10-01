/**
 * Calibration optimization execution for fresh and resumed runs.
 *
 * @internal
 * @since 0.5.0
 */
import { Optimization, OptimizationStorage } from "@scenesystems/effect-search"
import type {
  OptimizationEvent,
  OptimizationSnapshot,
  Pruning,
  Sampler,
  SearchSpace
} from "@scenesystems/effect-search"
import { StudyStorage } from "@scenesystems/effect-study"
import { Chunk, Data, Effect, Match, Option, Stream } from "effect"
import * as Arr from "effect/Array"
import type * as Layer from "effect/Layer"

import { OptimizationNotSingleObjective, OptimizationSnapshotMissing, Profile } from "../../Calibration.js"
import type * as Calibration from "../../Calibration.js"
import type * as MeasurementCache from "../../MeasurementCache.js"
import type * as Text from "../../Text.js"
import type * as TextMeasurer from "../../TextMeasurer.js"
import { evaluate } from "./evaluation.js"
import { scoreReport } from "./scoring.js"

class OptimizationRun extends Data.Class<{
  readonly eventLog: ReadonlyArray<OptimizationEvent.OptimizationEvent>
  readonly snapshot: OptimizationSnapshot.OptimizationSnapshot
  readonly optimizationResult: Optimization.SingleObjectiveResult<Text.Profile>
}> {}

class FreshOptimizationOptions extends Data.Class<{
  readonly cases: Calibration.Cases
  readonly objective: Calibration.Objective
  readonly sampler: Sampler.Sampler
  readonly services: Layer.Layer<Text.Segmenter | MeasurementCache.MeasurementCache>
  readonly storage: Option.Option<OptimizationStorage.Service>
  readonly space: SearchSpace.SearchSpace
  readonly trials: number
}> {}

class ResumedOptimizationOptions extends Data.Class<
  FreshOptimizationOptions & {
    readonly snapshot: OptimizationSnapshot.OptimizationSnapshot
  }
> {}

const asSingleObjectiveResult = <Config>(
  result: Optimization.Result<Config>
): Effect.Effect<Optimization.SingleObjectiveResult<Config>, OptimizationNotSingleObjective> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (singleObjective) => Effect.succeed(singleObjective)),
    Match.tag("MultiObjective", (multiObjective) =>
      Effect.fail(
        new OptimizationNotSingleObjective({
          trialCount: Arr.length(Arr.fromIterable(multiObjective.trials)),
          paretoFrontSize: Arr.length(Arr.fromIterable(multiObjective.paretoFront))
        })
      )),
    Match.exhaustive
  )

const makeInMemoryOptimizationStorage = Effect.gen(function*() {
  const storage = yield* StudyStorage.makeMemory()
  return yield* OptimizationStorage.make.pipe(Effect.provideService(StudyStorage.StudyStorage, storage))
})

const loadStoredSnapshot = (storage: OptimizationStorage.Service) =>
  storage.loadSnapshot().pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          storage.loadTrialLog().pipe(
            Effect.flatMap((trialLog) =>
              Effect.fail(new OptimizationSnapshotMissing({ trialLogLength: Arr.length(trialLog) }))
            )
          ),
        onSome: Effect.succeed
      })
    )
  )

const resolveOptimizationStorage = (storage: Option.Option<OptimizationStorage.Service>) =>
  storage.pipe(
    Option.match({
      onNone: () => makeInMemoryOptimizationStorage,
      onSome: Effect.succeed
    })
  )

const scoreCandidate = (
  profile: Text.Profile,
  cases: Calibration.Cases,
  services: Layer.Layer<Text.Segmenter | MeasurementCache.MeasurementCache>,
  objective: Calibration.Objective
) =>
  evaluate(Profile.make({ name: "candidate", profile }), cases).pipe(
    Effect.provide(services),
    Effect.map((report) => scoreReport(report, objective).total)
  )

const objectiveFunction = (
  cases: Calibration.Cases,
  services: Layer.Layer<Text.Segmenter | MeasurementCache.MeasurementCache>,
  objective: Calibration.Objective
): (
  profile: Text.Profile,
  runtime: Pruning.Runtime
) => Effect.Effect<number, TextMeasurer.Failed> =>
(
  profile: Text.Profile,
  _runtime: Pruning.Runtime
) => scoreCandidate(profile, cases, services, objective)

const storedOptimizationResult = (
  objective: (
    profile: Text.Profile,
    runtime: Pruning.Runtime
  ) => Effect.Effect<number, TextMeasurer.Failed>,
  sampler: Sampler.Sampler,
  space: SearchSpace.SearchSpace,
  storage: OptimizationStorage.Service
) =>
  Optimization.resumeFromStorage({
    space,
    sampler,
    direction: "minimize",
    trials: 0,
    objective
  }).pipe(
    Effect.provideService(OptimizationStorage.OptimizationStorage, storage),
    Effect.flatMap(asSingleObjectiveResult)
  )

/** @internal */
export const runFreshOptimization = (options: FreshOptimizationOptions) =>
  Effect.gen(function*() {
    const storage = yield* resolveOptimizationStorage(options.storage)
    const objective = objectiveFunction(options.cases, options.services, options.objective)
    const eventLog = yield* Optimization.stream({
      space: options.space,
      sampler: options.sampler,
      direction: "minimize",
      trials: options.trials,
      objective
    }).pipe(
      Stream.provideService(OptimizationStorage.OptimizationStorage, storage),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray)
    )
    const snapshot = yield* loadStoredSnapshot(storage)
    const optimizationResult = yield* storedOptimizationResult(objective, options.sampler, options.space, storage)

    return new OptimizationRun({ eventLog, snapshot, optimizationResult })
  })

/** @internal */
export const runResumedOptimization = (options: ResumedOptimizationOptions) =>
  Effect.gen(function*() {
    const storage = yield* resolveOptimizationStorage(options.storage)
    const objective = objectiveFunction(options.cases, options.services, options.objective)
    const eventLog = yield* Optimization.resumeStream({
      space: options.space,
      sampler: options.sampler,
      snapshot: options.snapshot,
      direction: "minimize",
      trials: options.trials,
      objective
    }).pipe(
      Stream.provideService(OptimizationStorage.OptimizationStorage, storage),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray)
    )
    const snapshot = yield* loadStoredSnapshot(storage)
    const optimizationResult = yield* storedOptimizationResult(objective, options.sampler, options.space, storage)

    return new OptimizationRun({ eventLog, snapshot, optimizationResult })
  })
