/**
 * Internal study runners for experimental calibration optimization.
 *
 * @internal
 * @since 0.2.0
 */
import * as Optimization from "@scenesystems/effect-search/Optimization"
import type * as OptimizationSnapshot from "@scenesystems/effect-search/OptimizationSnapshot"
import * as OptimizationStorage from "@scenesystems/effect-search/OptimizationStorage"
import type * as Pruning from "@scenesystems/effect-search/Pruning"
import type * as Sampler from "@scenesystems/effect-search/Sampler"
import type * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import { Chunk, Data, Effect, Match, Number as Num, Option, Ref, Stream } from "effect"
import type { Layer, Schema } from "effect"
import * as Arr from "effect/Array"

import type { MeasurementCache, WordSegmenter } from "../../../contracts/index.js"
import type { MeasurementFailed } from "../../../Errors/index.js"
import type { EngineProfileType } from "../../../Text/schema.js"
import { CalibrationSnapshotMissing, CalibrationStudyNotSingleObjective } from "../errors.js"
import { evaluateProfile } from "../evaluation.js"
import type { CalibrationCase, CalibrationObjectiveMetadataType } from "../schema.js"
import { scoreCalibrationReportSync } from "./scoring.js"
import { calibrationProfile } from "./search.js"

type CalibrationObjective = (
  engineProfile: EngineProfileType,
  runtime: Pruning.Runtime
) => Effect.Effect<number, MeasurementFailed>

const asSingleObjectiveResult = <Config>(
  result: Optimization.Result<Config>
): Effect.Effect<Optimization.SingleObjectiveResult<Config>, CalibrationStudyNotSingleObjective> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Effect.succeed(single)),
    Match.tag("MultiObjective", (multi) =>
      new CalibrationStudyNotSingleObjective({
        trialCount: Arr.length(Arr.fromIterable(multi.trials)),
        paretoFrontSize: Arr.length(Arr.fromIterable(multi.paretoFront))
      })),
    Match.exhaustive
  )

const makeInMemoryOptimizationStorage = Effect.gen(function*() {
  const snapshotRef = yield* Ref.make<Option.Option<OptimizationSnapshot.OptimizationSnapshot>>(Option.none())
  const trialLogRef = yield* Ref.make(Arr.empty<OptimizationSnapshot.Trial>())

  const storage: OptimizationStorage.Service = {
    appendTrial: (trial) => Ref.update(trialLogRef, Arr.append(trial)),
    loadSnapshot: () => Ref.get(snapshotRef),
    loadTrialLog: () => Ref.get(trialLogRef),
    replayTrialLog: () =>
      Effect.all({
        snapshot: Ref.get(snapshotRef),
        trials: Ref.get(trialLogRef)
      }).pipe(
        Effect.map(({ snapshot, trials }) =>
          Option.match(snapshot, {
            onNone: () => trials,
            onSome: (currentSnapshot) =>
              Arr.filter(
                trials,
                (trial) => Num.greaterThanOrEqualTo(trial.trialNumber, currentSnapshot.nextTrialNumber)
              )
          })
        )
      ),
    writeSnapshot: (snapshot) => Ref.set(snapshotRef, Option.some(snapshot))
  }

  return storage
})

const loadStoredSnapshot = (storage: OptimizationStorage.Service) =>
  storage.loadSnapshot().pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          storage.loadTrialLog().pipe(
            Effect.flatMap((trialLog) => new CalibrationSnapshotMissing({ trialLogLength: Arr.length(trialLog) }))
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

const objectiveFunction = (
  cases: Schema.Array$<typeof CalibrationCase>["Type"],
  services: Layer.Layer<WordSegmenter | MeasurementCache>,
  objective: CalibrationObjectiveMetadataType
): CalibrationObjective =>
(
  engineProfile: EngineProfileType,
  _runtime: Pruning.Runtime
) => scoreCandidate(engineProfile, cases, services, objective)

class StoredOptimizationOptions extends Data.Class<{
  readonly objective: CalibrationObjective
  readonly sampler: Sampler.Sampler
  readonly space: SearchSpace.SearchSpace
  readonly storage: OptimizationStorage.Service
}> {}

const storedOptimizationResult = (options: StoredOptimizationOptions) =>
  Optimization.resumeFromStorage({
    space: options.space,
    sampler: options.sampler,
    direction: "minimize",
    trials: 0,
    objective: options.objective
  }).pipe(
    Effect.provideService(OptimizationStorage.OptimizationStorage, options.storage),
    Effect.flatMap(asSingleObjectiveResult)
  )

const scoreCandidate = (
  engineProfile: EngineProfileType,
  cases: Schema.Array$<typeof CalibrationCase>["Type"],
  services: Layer.Layer<WordSegmenter | MeasurementCache>,
  objective: CalibrationObjectiveMetadataType
) =>
  evaluateProfile(calibrationProfile("candidate", engineProfile), cases).pipe(
    Effect.provide(services),
    Effect.map((report) => scoreCalibrationReportSync(report, objective)),
    Effect.map(({ total }) => total)
  )

class FreshStudyOptions extends Data.Class<{
  readonly cases: Schema.Array$<typeof CalibrationCase>["Type"]
  readonly objective: CalibrationObjectiveMetadataType
  readonly sampler: Sampler.Sampler
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly storage: Option.Option<OptimizationStorage.Service>
  readonly space: SearchSpace.SearchSpace
  readonly trials: number
}> {}

/**
 * Run one fresh calibration optimization and collect its ordered event log.
 *
 * @since 0.2.0
 * @category internals
 */
export const runFreshCalibrationStudy = (options: FreshStudyOptions) =>
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
    const studyResult = yield* storedOptimizationResult({
      objective,
      sampler: options.sampler,
      space: options.space,
      storage
    })

    return {
      eventLog,
      snapshot,
      studyResult
    }
  })

class ResumedStudyOptions extends Data.Class<{
  readonly cases: Schema.Array$<typeof CalibrationCase>["Type"]
  readonly objective: CalibrationObjectiveMetadataType
  readonly sampler: Sampler.Sampler
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly snapshot: OptimizationSnapshot.OptimizationSnapshot
  readonly storage: Option.Option<OptimizationStorage.Service>
  readonly space: SearchSpace.SearchSpace
  readonly trials: number
}> {}

/**
 * Resume a calibration optimization from a prior snapshot.
 *
 * @since 0.2.0
 * @category internals
 */
export const runResumedCalibrationStudy = (options: ResumedStudyOptions) =>
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
    const studyResult = yield* storedOptimizationResult({
      objective,
      sampler: options.sampler,
      space: options.space,
      storage
    })

    return {
      eventLog,
      snapshot,
      studyResult
    }
  })
