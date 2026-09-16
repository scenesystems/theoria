/**
 * Versioned study snapshots and validated recovery.
 *
 * @since 0.7.0
 * @module
 */
import * as Stop from "@scenesystems/effect-study/Stop"
import * as StudyTrial from "@scenesystems/effect-study/Trial"
import { Array as Arr, Boolean as Bool, Data, Effect, Equal, Match, Number as Num, Option, Order, Schema } from "effect"

import { Objective } from "./Objective.js"
import * as Sampler from "./Sampler.js"
import { InvalidStudyConfig } from "./SearchError.js"
import * as SearchSpace from "./SearchSpace.js"
import * as SearchTrial from "./Trial.js"

/** Current persisted snapshot format. @since 0.7.0 @category schemas */
export const FormatVersion = Schema.Literal(1)
/** @since 0.7.0 @category models */
export type FormatVersion = typeof FormatVersion.Type

/** Compatibility metadata required to continue a study. @since 0.7.0 @category schemas */
export const Metadata = Schema.Struct({
  spaceFingerprint: Schema.String,
  objectiveSpec: Objective,
  stopMode: Stop.Mode,
  samplerKind: Sampler.Kind,
  samplerCheckpoint: Sampler.Checkpoint
})
/** @since 0.7.0 @category models */
export type Metadata = typeof Metadata.Type

/** Persisted trial with an opaque encoded configuration. @since 0.7.0 @category schemas */
export const Trial = StudyTrial.Trial(Schema.Unknown, SearchTrial.State)
/** @since 0.7.0 @category models */
export type Trial = typeof Trial.Type

/** Derived diagnostics stored with a snapshot. @since 0.7.0 @category schemas */
export const Metrics = Schema.Struct({
  checkpointTag: Schema.String,
  completedCount: Schema.Number,
  retryCountTotal: Schema.Number,
  priorCount: Schema.Number
})
/** @since 0.7.0 @category models */
export type Metrics = typeof Metrics.Type

const Fields = {
  snapshotFormatVersion: FormatVersion,
  ...Metadata.fields,
  nextTrialNumber: Schema.Number,
  trials: Schema.Array(Trial),
  completedCount: Schema.Number,
  studyDuration: Schema.Number,
  samplerMetrics: Metrics
}

/** Canonical version-one study snapshot. @since 0.7.0 @category schemas */
export class StudySnapshot extends Schema.Class<StudySnapshot>("effect-search/StudySnapshot")(
  Fields
) {}

const stateDuration = (state: SearchTrial.State): number =>
  SearchTrial.matchState({
    Running: () => 0,
    Completed: ({ duration }) => duration,
    Failed: ({ duration }) => duration,
    Pruned: ({ duration }) => duration,
    Cancelled: () => 0
  })(state)

const isCompleted = <Config>(trial: SearchTrial.Trial<Config>): trial is SearchTrial.CompletedTrial<Config> =>
  SearchTrial.isState("Completed")(trial.state)

const retryCount = (trial: Trial): number =>
  SearchTrial.matchState({
    Running: () => 0,
    Completed: ({ retryCount }) => retryCount,
    Failed: () => 0,
    Pruned: () => 0,
    Cancelled: () => 0
  })(trial.state)

const priorCount = (trials: Iterable<Trial>): number =>
  Arr.reduce(
    trials,
    0,
    (count, trial) =>
      Match.value(trial.prior).pipe(
        Match.when(true, () => Num.increment(count)),
        Match.orElse(() => count)
      )
  )

const materialize = (metadata: Metadata, trials: Iterable<Trial>, completedCount: number): StudySnapshot => {
  const orderedTrials = Arr.fromIterable(trials)
  return new StudySnapshot({
    snapshotFormatVersion: 1,
    ...metadata,
    nextTrialNumber: Num.increment(
      Arr.reduce(orderedTrials, -1, (maximum, trial) => Num.max(maximum, trial.trialNumber))
    ),
    trials: orderedTrials,
    completedCount,
    studyDuration: Arr.reduce(orderedTrials, 0, (total, trial) => Num.sum(total, stateDuration(trial.state))),
    samplerMetrics: {
      checkpointTag: metadata.samplerCheckpoint._tag,
      completedCount,
      retryCountTotal: Arr.reduce(orderedTrials, 0, (total, trial) => Num.sum(total, retryCount(trial))),
      priorCount: priorCount(orderedTrials)
    }
  })
}

/** Converts a runtime trial to its persisted representation. @since 0.7.0 @category conversions */
export const fromTrial = <Config>(trial: SearchTrial.Trial<Config>): Trial => ({ ...trial })

/** Reconstructs a runtime trial after its configuration is decoded. @since 0.7.0 @category conversions */
export const toTrial = <Config>(trial: Trial, config: Config): SearchTrial.Trial<Config> =>
  Data.struct({ ...trial, config })

/** Builds a snapshot and derives all counters. @since 0.7.0 @category constructors */
export const make = <Config>(trials: Iterable<SearchTrial.Trial<Config>>, metadata: Metadata): StudySnapshot => {
  const persisted = Arr.map(Arr.fromIterable(trials), (trial) => fromTrial(trial))
  const completedCount = Arr.reduce(
    persisted,
    0,
    (count, trial) =>
      Match.value(SearchTrial.isState("Completed")(trial.state)).pipe(
        Match.when(true, () => Num.increment(count)),
        Match.orElse(() => count)
      )
  )
  return materialize(metadata, persisted, completedCount)
}

/** Decodes unknown snapshot input and recomputes derived diagnostics. @since 0.7.0 @category decoders */
export const decodeUnknown = (input: unknown) =>
  Schema.decodeUnknown(StudySnapshot)(input).pipe(
    Effect.map((snapshot) => materialize(snapshot, snapshot.trials, snapshot.completedCount))
  )

const duplicateTrialNumber = (trials: Iterable<Trial>): Option.Option<number> => {
  const values = Arr.fromIterable(trials)
  return Arr.findFirst(
    values,
    (trial, index) =>
      Arr.some(
        Arr.drop(values, Num.increment(index)),
        (candidate) => Num.Equivalence(candidate.trialNumber, trial.trialNumber)
      )
  ).pipe(
    Option.map((trial) => trial.trialNumber)
  )
}

/** Merges an append-log tail into a snapshot after validating numbering. @since 0.7.0 @category recovery */
export const recover = (
  snapshot: StudySnapshot,
  replayTail: Iterable<Trial>
): Effect.Effect<StudySnapshot, InvalidStudyConfig> =>
  Effect.gen(function*() {
    const tail = Arr.fromIterable(replayTail)
    const stale = Arr.findFirst(tail, (trial) => Num.lessThan(trial.trialNumber, snapshot.nextTrialNumber))
    yield* Option.match(stale, {
      onNone: () => Effect.void,
      onSome: (trial) =>
        Effect.fail(
          new InvalidStudyConfig({
            reason: `Study.resumeFromStorage replay tail includes stale trial ${trial.trialNumber}`
          })
        )
    })
    const trials = Arr.sort(
      Arr.appendAll(snapshot.trials, tail),
      Order.mapInput(Num.Order, (trial: Trial) => trial.trialNumber)
    )
    yield* Option.match(duplicateTrialNumber(trials), {
      onNone: () => Effect.void,
      onSome: (trialNumber) =>
        Effect.fail(
          new InvalidStudyConfig({
            reason: `Study.resumeFromStorage replay tail produced duplicate trial number ${trialNumber}`
          })
        )
    })
    const completedCount = Arr.reduce(
      trials,
      0,
      (count, trial) =>
        Match.value(SearchTrial.isState("Completed")(trial.state)).pipe(
          Match.when(true, () => Num.increment(count)),
          Match.orElse(() => count)
        )
    )
    return materialize(snapshot, trials, completedCount)
  })

/** Validated execution seed recovered from a snapshot. @since 0.7.0 @category models */
export class Seed<Config> extends Data.Class<{
  readonly initialTrials: Iterable<SearchTrial.Trial<Config>>
  readonly startTrialNumber: number
}> {}

const invalid = (reason: string) => new InvalidStudyConfig({ reason })

/** Validates compatibility, restores sampler state, and decodes configurations. @since 0.7.0 @category recovery */
export const restore = <Space extends SearchSpace.SearchSpace>(
  space: Space,
  sampler: Sampler.Sampler,
  objectiveSpec: Metadata["objectiveSpec"],
  stopMode: Stop.Mode,
  snapshot: StudySnapshot
): Effect.Effect<Seed<SearchSpace.Type<Space>>, InvalidStudyConfig> =>
  Effect.gen(function*() {
    const persisted = yield* Schema.decodeUnknown(StudySnapshot)(snapshot).pipe(
      Effect.mapError(() => invalid("Study.resume snapshot payload decode failed"))
    )
    const decoded = materialize(persisted, persisted.trials, persisted.completedCount)
    yield* Effect.when(
      Effect.fail(invalid("Study.resume space fingerprint mismatch")),
      () => Bool.not(Equal.equals(decoded.spaceFingerprint, SearchSpace.fingerprint(space)))
    )
    yield* Effect.when(
      Effect.fail(invalid("Study.resume objective specification mismatch")),
      () => Bool.not(Schema.equivalence(Objective)(decoded.objectiveSpec, objectiveSpec))
    )
    yield* Effect.when(
      Effect.fail(invalid("Study.resume stop mode mismatch")),
      () => Bool.not(Equal.equals(decoded.stopMode, stopMode))
    )
    yield* Effect.when(
      Effect.fail(invalid("Study.resume sampler kind mismatch")),
      () => Bool.not(Schema.equivalence(Sampler.Kind)(decoded.samplerKind, sampler.kind))
    )
    yield* Sampler.restore(sampler, decoded.samplerCheckpoint)
    const initialTrials = yield* Effect.forEach(decoded.trials, (trial) =>
      Schema.decodeUnknown(space.schema)(trial.config).pipe(
        Effect.map((config) =>
          toTrial(trial, config)
        ),
        Effect.mapError(() => invalid(`Study.resume trial ${trial.trialNumber} has an invalid configuration`))
      ))
    const computedCompleted = Arr.length(Arr.filter(initialTrials, isCompleted))
    const computedNext = Num.increment(
      Arr.reduce(initialTrials, -1, (maximum, trial) => Num.max(maximum, trial.trialNumber))
    )
    yield* Effect.when(
      Effect.fail(invalid("Study.resume next trial number mismatch")),
      () => Bool.not(Num.Equivalence(computedNext, persisted.nextTrialNumber))
    )
    yield* Effect.when(
      Effect.fail(invalid("Study.resume completed count mismatch")),
      () => Bool.not(Num.Equivalence(computedCompleted, persisted.completedCount))
    )
    return new Seed({ initialTrials, startTrialNumber: decoded.nextTrialNumber })
  }).pipe(Effect.withSpan("effect-search/StudySnapshot.restore"))
