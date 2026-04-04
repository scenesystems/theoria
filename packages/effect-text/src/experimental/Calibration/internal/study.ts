/**
 * Internal study runners for experimental calibration optimization.
 *
 * @internal
 * @since 0.2.0
 */
import { Chunk, Effect, Number as Num, Option, Ref, Stream } from "effect"
import type { Layer } from "effect"
import { Study } from "effect-search"
import type * as EffectSearch from "effect-search"
import * as Arr from "effect/Array"

import type { MeasurementCache, WordSegmenter } from "../../../contracts/index.js"
import type { EngineProfileType } from "../../../Text/schema.js"
import { evaluateProfile } from "../evaluation.js"
import type { CalibrationCaseType, CalibrationObjectiveMetadataType } from "../schema.js"
import { scoreCalibrationReportSync } from "./scoring.js"
import { calibrationProfile } from "./search.js"

type CalibrationObjective = (
  engineProfile: EngineProfileType,
  runtime: EffectSearch.Study.ObjectiveTrialRuntime
) => Effect.Effect<number, unknown>

const asSingleObjectiveResult = <Config>(
  result: Study.StudyResult<Config>
): Effect.Effect<Study.SingleObjectiveResult<Config>> =>
  result._tag === "SingleObjective"
    ? Effect.succeed(result)
    : Effect.dieMessage("Experimental.Calibration.optimizeProfile requires a single-objective study result")

const makeInMemoryStudyStorage = Effect.gen(function*() {
  const snapshotRef = yield* Ref.make<Option.Option<Study.StudySnapshot>>(Option.none())
  const trialLogRef = yield* Ref.make<Array<Study.SnapshotTrial>>([])

  const storage: Study.StudyStorageApi = {
    appendTrial: (trial) => Ref.update(trialLogRef, (trials) => [...trials, trial]),
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
        onNone: () => Effect.dieMessage("Experimental.Calibration.optimizeProfile expected a persisted StudySnapshot"),
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
  cases: ReadonlyArray<CalibrationCaseType>,
  services: Layer.Layer<WordSegmenter | MeasurementCache>,
  objective: CalibrationObjectiveMetadataType
): CalibrationObjective =>
(
  engineProfile: EngineProfileType,
  _runtime: EffectSearch.Study.ObjectiveTrialRuntime
) => scoreCandidate(engineProfile, cases, services, objective)

const storedStudyResult = (options: {
  readonly objective: CalibrationObjective
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly storage: Study.StudyStorageApi
}) =>
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
  cases: ReadonlyArray<CalibrationCaseType>,
  services: Layer.Layer<WordSegmenter | MeasurementCache>,
  objective: CalibrationObjectiveMetadataType
) =>
  evaluateProfile(calibrationProfile("candidate", engineProfile), cases).pipe(
    Effect.provide(services),
    Effect.map((report) => scoreCalibrationReportSync(report, objective)),
    Effect.map(({ total }) => total)
  )

/**
 * Run one fresh calibration study and collect its ordered event log.
 *
 * @since 0.2.0
 * @category internals
 */
export const runFreshCalibrationStudy = (options: {
  readonly cases: ReadonlyArray<CalibrationCaseType>
  readonly objective: CalibrationObjectiveMetadataType
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly storage: Option.Option<Study.StudyStorageApi>
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly trials: number
}) =>
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

/**
 * Resume a calibration study from a prior snapshot.
 *
 * @since 0.2.0
 * @category internals
 */
export const runResumedCalibrationStudy = (options: {
  readonly cases: ReadonlyArray<CalibrationCaseType>
  readonly objective: CalibrationObjectiveMetadataType
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly snapshot: Study.StudySnapshot
  readonly storage: Option.Option<Study.StudyStorageApi>
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly trials: number
}) =>
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
