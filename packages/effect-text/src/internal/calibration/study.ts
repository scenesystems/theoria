/**
 * Fresh and resumed calibration study execution.
 *
 * @internal
 * @since 0.5.0
 */
import { Study, StudyEvent } from "@scenesystems/effect-search"
import type * as EffectSearch from "@scenesystems/effect-search"
import { Chunk, Data, Effect, Match, Number as Num, Option, Ref, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import type * as Layer from "effect/Layer"

import { Profile, SnapshotMissing, StudyNotSingleObjective } from "../../Calibration.js"
import type * as Calibration from "../../Calibration.js"
import type * as MeasurementCache from "../../MeasurementCache.js"
import type * as Text from "../../Text.js"
import type * as TextMeasurer from "../../TextMeasurer.js"
import { evaluate } from "./evaluation.js"
import { scoreReport } from "./scoring.js"

const TrialLog = Schema.mutable(Schema.Array(Study.SnapshotTrialSchema))
type TrialLog = typeof TrialLog.Type
const EventLog = Schema.Array(StudyEvent.StudyEventSchema)
type EventLog = typeof EventLog.Type

class StudyRun extends Data.Class<{
  readonly eventLog: EventLog
  readonly snapshot: Study.StudySnapshot
  readonly studyResult: Study.SingleObjectiveResult<Text.Profile>
}> {}

class FreshStudyOptions extends Data.Class<{
  readonly cases: Calibration.Cases
  readonly objective: Calibration.Objective
  readonly sampler: EffectSearch.Sampler.Sampler
  readonly services: Layer.Layer<Text.Segmenter | MeasurementCache.MeasurementCache>
  readonly storage: Option.Option<Study.StudyStorageApi>
  readonly space: EffectSearch.SearchSpace.SearchSpace
  readonly trials: number
}> {}

class ResumedStudyOptions extends Data.Class<
  FreshStudyOptions & {
    readonly snapshot: Study.StudySnapshot
  }
> {}

const asSingleObjectiveResult = <Config>(
  result: Study.StudyResult<Config>
): Effect.Effect<Study.SingleObjectiveResult<Config>, StudyNotSingleObjective> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (singleObjective) => Effect.succeed(singleObjective)),
    Match.tag("MultiObjective", (multiObjective) =>
      Effect.fail(
        new StudyNotSingleObjective({
          trialCount: Arr.length(multiObjective.trials),
          paretoFrontSize: Arr.length(multiObjective.paretoFront)
        })
      )),
    Match.exhaustive
  )

const makeInMemoryStudyStorage = Effect.gen(function*() {
  const snapshotRef = yield* Ref.make<Option.Option<Study.StudySnapshot>>(Option.none())
  const trialLogRef = yield* Ref.make<TrialLog>(Arr.empty())

  return Study.StudyStorage.of({
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
            Effect.flatMap((trialLog) => Effect.fail(new SnapshotMissing({ trialLogLength: Arr.length(trialLog) })))
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
  runtime: EffectSearch.Study.ObjectiveTrialRuntime
) => Effect.Effect<number, TextMeasurer.Failed> =>
(
  profile: Text.Profile,
  _runtime: EffectSearch.Study.ObjectiveTrialRuntime
) => scoreCandidate(profile, cases, services, objective)

const storedStudyResult = (
  objective: (
    profile: Text.Profile,
    runtime: EffectSearch.Study.ObjectiveTrialRuntime
  ) => Effect.Effect<number, TextMeasurer.Failed>,
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

/** @internal */
export const runFreshStudy = (options: FreshStudyOptions) =>
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

    return new StudyRun({ eventLog, snapshot, studyResult })
  })

/** @internal */
export const runResumedStudy = (options: ResumedStudyOptions) =>
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

    return new StudyRun({ eventLog, snapshot, studyResult })
  })
