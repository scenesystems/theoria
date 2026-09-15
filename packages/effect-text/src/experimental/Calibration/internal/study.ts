/**
 * Internal study runners for experimental calibration optimization.
 *
 * @internal
 * @since 0.2.0
 */
import { Study } from "@scenesystems/effect-search"
import type * as EffectSearch from "@scenesystems/effect-search"
import { Array as Arr, Chunk, Data, Effect, Match, Number as Num, Option, Ref, Stream } from "effect"
import type { Layer } from "effect"

import type { MeasurementCache, WordSegmenter } from "../../../contracts/index.js"
import type { MeasurementFailed } from "../../../Errors/index.js"
import type { EngineProfileType } from "../../../Text/schema.js"
import { CalibrationSnapshotMissing, CalibrationStudyNotSingleObjective } from "../errors.js"
import { evaluateProfile } from "../evaluation.js"
import type {
  CalibrationCasesType,
  CalibrationObjectiveMetadataType,
  CalibrationStudyEventLogType,
  CalibrationTrialLogType
} from "../schema.js"
import { scoreCalibrationReportSync } from "./scoring.js"
import { calibrationProfile } from "./search.js"

class CalibrationStudyRun extends Data.Class<{
  readonly eventLog: CalibrationStudyEventLogType
  readonly snapshot: Study.StudySnapshot
  readonly studyResult: Study.SingleObjectiveResult<EngineProfileType>
}> {}

class CalibrationStudyStorage extends Data.Class<Study.StudyStorageApi> {}

export class FreshCalibrationStudyOptions extends Data.Class<{
  readonly cases: CalibrationCasesType
  readonly objective: CalibrationObjectiveMetadataType
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly storage: Option.Option<Study.StudyStorageApi>
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly trials: number
}> {}

export class ResumedCalibrationStudyOptions extends Data.Class<{
  readonly cases: CalibrationCasesType
  readonly objective: CalibrationObjectiveMetadataType
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly snapshot: Study.StudySnapshot
  readonly storage: Option.Option<Study.StudyStorageApi>
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly trials: number
}> {}

const asSingleObjectiveResult = <Config>(
  result: Study.StudyResult<Config>
): Effect.Effect<Study.SingleObjectiveResult<Config>, CalibrationStudyNotSingleObjective> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (singleObjective) => Effect.succeed(singleObjective)),
    Match.tag("MultiObjective", (multiObjective) =>
      Effect.fail(
        new CalibrationStudyNotSingleObjective({
          trialCount: Arr.length(multiObjective.trials),
          paretoFrontSize: Arr.length(multiObjective.paretoFront)
        })
      )),
    Match.exhaustive
  )

const makeInMemoryStudyStorage = Effect.gen(function*() {
  const snapshotRef = yield* Ref.make<Option.Option<Study.StudySnapshot>>(Option.none())
  const trialLogRef = yield* Ref.make<CalibrationTrialLogType>(Arr.empty())

  return new CalibrationStudyStorage({
    appendTrial: (trial) => Ref.update(trialLogRef, (trials) => Arr.append(trials, trial)),
    loadSnapshot: () => Ref.get(snapshotRef),
    loadTrialLog: () => Ref.get(trialLogRef),
    replayTrialLog: () =>
      Effect.gen(function*() {
        const snapshot = yield* Ref.get(snapshotRef)
        const trials = yield* Ref.get(trialLogRef)

        return Option.match(snapshot, {
          onNone: () => trials,
          onSome: (currentSnapshot) =>
            Arr.filter(
              trials,
              (trial) => Num.greaterThanOrEqualTo(trial.trialNumber, currentSnapshot.nextTrialNumber)
            )
        })
      }),
    writeSnapshot: (snapshot) => Ref.set(snapshotRef, Option.some(snapshot))
  })
})

const loadStoredSnapshot = (storage: Study.StudyStorageApi) =>
  storage.loadSnapshot().pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          storage.loadTrialLog().pipe(
            Effect.flatMap((trialLog) =>
              Effect.fail(new CalibrationSnapshotMissing({ trialLogLength: Arr.length(trialLog) }))
            )
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
  cases: CalibrationCasesType,
  services: Layer.Layer<WordSegmenter | MeasurementCache>,
  objective: CalibrationObjectiveMetadataType
): (
  engineProfile: EngineProfileType,
  runtime: EffectSearch.Study.ObjectiveTrialRuntime
) => Effect.Effect<number, MeasurementFailed> =>
(
  engineProfile: EngineProfileType,
  _runtime: EffectSearch.Study.ObjectiveTrialRuntime
) => scoreCandidate(engineProfile, cases, services, objective)

const storedStudyResult = (
  objective: (
    engineProfile: EngineProfileType,
    runtime: EffectSearch.Study.ObjectiveTrialRuntime
  ) => Effect.Effect<number, MeasurementFailed>,
  sampler: EffectSearch.Sampler.Sampler,
  space: EffectSearch.SearchSpace.SearchSpace,
  storage: Study.StudyStorageApi
) =>
  Study.resumeFromStorage({
    space,
    sampler,
    direction: "minimize",
    trials: 0,
    objective
  }).pipe(
    Effect.provideService(Study.StudyStorage, storage),
    Effect.flatMap(asSingleObjectiveResult)
  )

const scoreCandidate = (
  engineProfile: EngineProfileType,
  cases: CalibrationCasesType,
  services: Layer.Layer<WordSegmenter | MeasurementCache>,
  objective: CalibrationObjectiveMetadataType
) =>
  evaluateProfile(calibrationProfile("candidate", engineProfile), cases).pipe(
    Effect.provide(services),
    Effect.map((report) => scoreCalibrationReportSync(report, objective).total)
  )

/**
 * Run one fresh calibration study and collect its ordered event log.
 *
 * @since 0.2.0
 * @category internals
 */
export const runFreshCalibrationStudy = (options: FreshCalibrationStudyOptions) =>
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
    const studyResult = yield* storedStudyResult(objective, options.sampler, options.space, storage)

    return new CalibrationStudyRun({
      eventLog,
      snapshot,
      studyResult
    })
  })

/**
 * Resume a calibration study from a prior snapshot.
 *
 * @since 0.2.0
 * @category internals
 */
export const runResumedCalibrationStudy = (options: ResumedCalibrationStudyOptions) =>
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
    const studyResult = yield* storedStudyResult(objective, options.sampler, options.space, storage)

    return new CalibrationStudyRun({
      eventLog,
      snapshot,
      studyResult
    })
  })
