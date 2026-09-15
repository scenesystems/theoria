/**
 * Internal study runners for experimental calibration optimization.
 *
 * @internal
 * @since 0.2.0
 */
import { Study } from "@scenesystems/effect-search"
import type * as EffectSearch from "@scenesystems/effect-search"
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
  runtime: EffectSearch.Study.ObjectiveTrialRuntime
) => Effect.Effect<number, MeasurementFailed>

const asSingleObjectiveResult = <Config>(
  result: Study.StudyResult<Config>
): Effect.Effect<Study.SingleObjectiveResult<Config>, CalibrationStudyNotSingleObjective> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Effect.succeed(single)),
    Match.tag("MultiObjective", (multi) =>
      new CalibrationStudyNotSingleObjective({
        trialCount: Arr.length(multi.trials),
        paretoFrontSize: Arr.length(multi.paretoFront)
      })),
    Match.exhaustive
  )

const makeInMemoryStudyStorage = Effect.gen(function*() {
  const snapshotRef = yield* Ref.make<Option.Option<Study.StudySnapshot>>(Option.none())
  const trialLogRef = yield* Ref.make(Arr.empty<Study.SnapshotTrial>())

  const storage: Study.StudyStorageApi = {
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

const loadStoredSnapshot = (storage: Study.StudyStorageApi) =>
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

const resolveStudyStorage = (storage: Option.Option<Study.StudyStorageApi>) =>
  storage.pipe(
    Option.match({
      onNone: () => makeInMemoryStudyStorage,
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
  _runtime: EffectSearch.Study.ObjectiveTrialRuntime
) => scoreCandidate(engineProfile, cases, services, objective)

class StoredStudyOptions extends Data.Class<{
  readonly objective: CalibrationObjective
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly storage: Study.StudyStorageApi
}> {}

const storedStudyResult = (options: StoredStudyOptions) =>
  Study.resumeFromStorage({
    space: options.space,
    sampler: options.sampler,
    direction: "minimize",
    trials: 0,
    objective: options.objective
  }).pipe(
    Effect.provideService(Study.StudyStorage, options.storage),
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
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly storage: Option.Option<Study.StudyStorageApi>
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly trials: number
}> {}

/**
 * Run one fresh calibration study and collect its ordered event log.
 *
 * @since 0.2.0
 * @category internals
 */
export const runFreshCalibrationStudy = (options: FreshStudyOptions) =>
  Effect.gen(function*() {
    const storage = yield* resolveStudyStorage(options.storage)
    const objective = objectiveFunction(options.cases, options.services, options.objective)
    const eventLog = yield* Study.optimizeStream({
      space: options.space,
      sampler: options.sampler,
      direction: "minimize",
      trials: options.trials,
      objective
    }).pipe(
      Stream.provideService(Study.StudyStorage, storage),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray)
    )
    const snapshot = yield* loadStoredSnapshot(storage)
    const studyResult = yield* storedStudyResult({
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
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly snapshot: Study.StudySnapshot
  readonly storage: Option.Option<Study.StudyStorageApi>
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly trials: number
}> {}

/**
 * Resume a calibration study from a prior snapshot.
 *
 * @since 0.2.0
 * @category internals
 */
export const runResumedCalibrationStudy = (options: ResumedStudyOptions) =>
  Effect.gen(function*() {
    const storage = yield* resolveStudyStorage(options.storage)
    const objective = objectiveFunction(options.cases, options.services, options.objective)
    const eventLog = yield* Study.resumeStream({
      space: options.space,
      sampler: options.sampler,
      snapshot: options.snapshot,
      direction: "minimize",
      trials: options.trials,
      objective
    }).pipe(
      Stream.provideService(Study.StudyStorage, storage),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray)
    )
    const snapshot = yield* loadStoredSnapshot(storage)
    const studyResult = yield* storedStudyResult({
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
