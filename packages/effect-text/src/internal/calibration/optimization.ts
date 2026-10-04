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
import { Data, Effect, Match, Option, Stream } from "effect"
import * as Arr from "effect/Array"
import type * as Layer from "effect/Layer"

import { OptimizationNotSingleObjective, OptimizationSnapshotMissing, Profile } from "../../Calibration.js"
import type * as Calibration from "../../Calibration.js"
import type * as MeasurementCache from "../../MeasurementCache.js"
import type * as Text from "../../Text.js"
import type * as TextMeasurer from "../../TextMeasurer.js"
import { evaluate } from "./evaluation.js"
import { scoreReport } from "./scoring.js"

type ProfileSpace = Calibration.CalibrationSearchSpace

class OptimizationRun extends Data.Class<{
  readonly eventLog: ReadonlyArray<OptimizationEvent.OptimizationEvent>
  readonly snapshot: OptimizationSnapshot.OptimizationSnapshot
  readonly optimizationResult: Optimization.SingleObjectiveResult<Text.Profile>
}> {}

/** @internal */
export class FreshOptimizationOptions<Space extends ProfileSpace> extends Data.Class<{
  readonly cases: Calibration.Cases
  readonly objective: Calibration.Objective
  readonly sampler: Sampler.Sampler
  readonly services: Layer.Layer<Text.Segmenter | MeasurementCache.MeasurementCache>
  readonly storage: Option.Option<OptimizationStorage.Service>
  readonly space: Space
  readonly trials: number
}> {}

type FreshOptions<Space extends ProfileSpace> = ConstructorParameters<
  typeof FreshOptimizationOptions<Space>
>[0]

/** @internal */
export class ResumedOptimizationOptions<Space extends ProfileSpace> extends Data.Class<
  FreshOptions<Space> & {
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
  const storage = yield* StudyStorage.makeMemory
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

const storedOptimizationResult = <Space extends ProfileSpace>(
  objective: (
    profile: SearchSpace.Type<Space>,
    runtime: Pruning.Runtime
  ) => Effect.Effect<number, TextMeasurer.Failed>,
  sampler: Sampler.Sampler,
  space: Space,
  storage: OptimizationStorage.Service
) =>
  Optimization.resumeFromStorage(
    new Optimization.StorageResumeOptions({
      space,
      sampler,
      direction: "minimize",
      trials: 0,
      objective
    })
  ).pipe(
    Effect.provideService(OptimizationStorage.OptimizationStorage, storage),
    Effect.flatMap(asSingleObjectiveResult)
  )

/** @internal */
export const runFreshOptimization = <Space extends ProfileSpace>(
  options: FreshOptimizationOptions<Space>
) =>
  Effect.gen(function*() {
    const storage = yield* resolveOptimizationStorage(options.storage)
    const objective = objectiveFunction(options.cases, options.services, options.objective)
    const eventLog = yield* Optimization.stream(
      new Optimization.FlatOptions({
        space: options.space,
        sampler: options.sampler,
        direction: "minimize",
        trials: options.trials,
        objective
      })
    ).pipe(
      Stream.provideService(OptimizationStorage.OptimizationStorage, storage),
      Stream.runCollect,
      Effect.map(Arr.fromIterable)
    )
    const snapshot = yield* loadStoredSnapshot(storage)
    const optimizationResult = yield* storedOptimizationResult(objective, options.sampler, options.space, storage)

    return new OptimizationRun({ eventLog, snapshot, optimizationResult })
  })

/** @internal */
export const runResumedOptimization = <Space extends ProfileSpace>(
  options: ResumedOptimizationOptions<Space>
) =>
  Effect.gen(function*() {
    const storage = yield* resolveOptimizationStorage(options.storage)
    const objective = objectiveFunction(options.cases, options.services, options.objective)
    const eventLog = yield* Optimization.resumeStream(
      new Optimization.ResumeOptions({
        space: options.space,
        sampler: options.sampler,
        snapshot: options.snapshot,
        direction: "minimize",
        trials: options.trials,
        objective
      })
    ).pipe(
      Stream.provideService(OptimizationStorage.OptimizationStorage, storage),
      Stream.runCollect,
      Effect.map(Arr.fromIterable)
    )
    const snapshot = yield* loadStoredSnapshot(storage)
    const optimizationResult = yield* storedOptimizationResult(objective, options.sampler, options.space, storage)

    return new OptimizationRun({ eventLog, snapshot, optimizationResult })
  })
