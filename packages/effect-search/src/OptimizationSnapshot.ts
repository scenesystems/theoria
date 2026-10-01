/**
 * Optimization snapshots and validated recovery.
 *
 * @since 0.7.0
 * @module
 */
import * as Stop from "@scenesystems/effect-study/Stop"
import * as StudyTrial from "@scenesystems/effect-study/Trial"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Equal,
  HashSet,
  Match,
  Number as Num,
  Option,
  Order,
  Schema
} from "effect"

import { Objective } from "./Objective.js"
import * as Sampler from "./Sampler.js"
import { InvalidOptimizationConfig } from "./SearchError.js"
import * as SearchSpace from "./SearchSpace.js"
import * as SearchTrial from "./Trial.js"

/** Search space, objective, and sampler state required to continue an optimization. @since 0.7.0 @category schemas */
export const Metadata = Schema.Struct({
  spaceFingerprint: Schema.String,
  objectiveSpec: Objective,
  stopMode: Stop.Mode,
  samplerKind: Sampler.Kind,
  samplerCheckpoint: Sampler.Checkpoint
})
/** Continuation metadata decoded by {@link Metadata}. @since 0.7.0 @category models */
export type Metadata = typeof Metadata.Type

const Count = Schema.Int.pipe(Schema.nonNegative())
const NonNegativeFinite = Schema.NonNegative.pipe(Schema.finite())

const stateDuration = (state: SearchTrial.State): number =>
  SearchTrial.matchState({
    Running: () => 0,
    Completed: ({ duration }) => duration,
    Failed: ({ duration }) => duration,
    Pruned: ({ duration }) => duration,
    Cancelled: () => 0
  })(state)

/** Persisted trial with an opaque encoded configuration. @since 0.7.0 @category schemas */
export const Trial = Schema.Struct({
  ...StudyTrial.Trial(Schema.Unknown, SearchTrial.State).fields,
  trialNumber: Schema.Int
}).pipe(
  Schema.filter((trial) =>
    Match.value(trial.prior).pipe(
      Match.when(
        true,
        () => Bool.and(Num.lessThan(trial.trialNumber, 0), SearchTrial.isState("Completed")(trial.state))
      ),
      Match.orElse(() => Num.greaterThanOrEqualTo(trial.trialNumber, 0))
    ), { message: () => "Only completed prior trials may have negative trial numbers" }),
  Schema.filter((trial) => Schema.is(NonNegativeFinite)(stateDuration(trial.state)), {
    message: () => "Trial durations must be finite and non-negative"
  }),
  Schema.annotations({ identifier: "@scenesystems/effect-search/OptimizationSnapshot/Trial" })
)
/** Persisted trial decoded by {@link Trial}. @since 0.7.0 @category models */
export type Trial = typeof Trial.Type

const Trials = Schema.Array(Trial).pipe(Schema.filter(
  (trials) =>
    Num.Equivalence(
      HashSet.size(HashSet.fromIterable(Arr.map(trials, (trial) => trial.trialNumber))),
      Arr.length(trials)
    ),
  { message: () => "Snapshot trial numbers must be unique" }
))
const Contents = Schema.Struct({ ...Metadata.fields, trials: Trials })

/** Derived diagnostics stored with a snapshot. @since 0.7.0 @category schemas */
export const Metrics = Schema.Struct({
  checkpointTag: Schema.String,
  completedCount: Count,
  retryCountTotal: Count,
  priorCount: Count
})
/** Snapshot diagnostics decoded by {@link Metrics}. @since 0.7.0 @category models */
export type Metrics = typeof Metrics.Type

const Fields = {
  ...Contents.fields,
  nextTrialNumber: Count,
  completedCount: Count,
  optimizationDuration: NonNegativeFinite,
  samplerMetrics: Metrics
}

/** Persisted optimization state and derived diagnostics. @since 0.7.0 @category schemas */
export class OptimizationSnapshot extends Schema.Class<OptimizationSnapshot>(
  "@scenesystems/effect-search/OptimizationSnapshot"
)(Fields) {}

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

const deriveFields = (metadata: Metadata, trials: Iterable<Trial>) => {
  const orderedTrials = Arr.fromIterable(trials)
  const completedCount = Arr.length(Arr.filter(orderedTrials, isCompleted))
  return {
    ...metadata,
    nextTrialNumber: Num.increment(
      Arr.reduce(orderedTrials, Num.negate(1), (maximum, trial) => Num.max(maximum, trial.trialNumber))
    ),
    trials: orderedTrials,
    completedCount,
    optimizationDuration: Arr.reduce(orderedTrials, 0, (total, trial) => Num.sum(total, stateDuration(trial.state))),
    samplerMetrics: {
      checkpointTag: metadata.samplerCheckpoint._tag,
      completedCount,
      retryCountTotal: Arr.reduce(orderedTrials, 0, (total, trial) => Num.sum(total, retryCount(trial))),
      priorCount: priorCount(orderedTrials)
    }
  }
}

/** Converts a runtime trial to its persisted opaque-configuration representation. @since 0.7.0 @category conversions */
export const fromTrial = <Config>(trial: SearchTrial.Trial<Config>): Trial => ({ ...trial })

/** Reconstructs a runtime trial with a caller-decoded configuration. @since 0.7.0 @category conversions */
export const toTrial = <Config>(trial: Trial, config: Config): SearchTrial.Trial<Config> =>
  Data.struct({ ...trial, config })

/** Builds a replay snapshot and derives numbering, duration, retry, and prior counters. @since 0.7.0 @category constructors */
export const make = <Config>(trials: Iterable<SearchTrial.Trial<Config>>, metadata: Metadata): OptimizationSnapshot => {
  const persisted = Arr.map(Arr.fromIterable(trials), (trial) => fromTrial(trial))
  return new OptimizationSnapshot(deriveFields(metadata, persisted))
}

/** Decodes unknown snapshot input and recomputes derived diagnostics rather than trusting them. @since 0.7.0 @category decoding */
export const decodeUnknown = (input: unknown) =>
  Schema.decodeUnknown(Contents)(input).pipe(
    Effect.flatMap((snapshot) => Schema.decodeUnknown(OptimizationSnapshot)(deriveFields(snapshot, snapshot.trials)))
  )

const invalid = (reason: string) => new InvalidOptimizationConfig({ reason })

const validated = (input: unknown): Effect.Effect<OptimizationSnapshot, InvalidOptimizationConfig> =>
  Effect.gen(function*() {
    const persisted = yield* Schema.decodeUnknown(OptimizationSnapshot)(input).pipe(
      Effect.mapError(() => invalid("Optimization.resume snapshot payload decode failed"))
    )
    const decoded = yield* decodeUnknown(persisted).pipe(
      Effect.mapError(() => invalid("Optimization.resume snapshot diagnostics are invalid"))
    )
    yield* Effect.when(
      Effect.fail(invalid("Optimization.resume snapshot next trial number mismatch")),
      () => Bool.not(Num.Equivalence(decoded.nextTrialNumber, persisted.nextTrialNumber))
    )
    yield* Effect.when(
      Effect.fail(invalid("Optimization.resume snapshot completed count mismatch")),
      () => Bool.not(Num.Equivalence(decoded.completedCount, persisted.completedCount))
    )
    return decoded
  })

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

/** Merges an append-log tail after rejecting stale or duplicate trial numbers. @since 0.7.0 @category recovery */
export const recover = (
  snapshot: OptimizationSnapshot,
  replayTail: Iterable<Trial>
): Effect.Effect<OptimizationSnapshot, InvalidOptimizationConfig> =>
  Effect.gen(function*() {
    const checkpoint = yield* validated(snapshot)
    const tail = yield* Schema.decodeUnknown(Schema.Array(Trial))(Arr.fromIterable(replayTail)).pipe(
      Effect.mapError(() => invalid("Optimization.resumeFromStorage replay tail payload decode failed"))
    )
    const stale = Arr.findFirst(tail, (trial) => Num.lessThan(trial.trialNumber, checkpoint.nextTrialNumber))
    yield* Option.match(stale, {
      onNone: () => Effect.void,
      onSome: (trial) =>
        Effect.fail(
          new InvalidOptimizationConfig({
            reason: `Optimization.resumeFromStorage replay tail includes stale trial ${trial.trialNumber}`
          })
        )
    })
    const trials = Arr.sort(
      Arr.appendAll(checkpoint.trials, tail),
      Order.mapInput(Num.Order, (trial: Trial) => trial.trialNumber)
    )
    yield* Option.match(duplicateTrialNumber(trials), {
      onNone: () => Effect.void,
      onSome: (trialNumber) =>
        Effect.fail(
          new InvalidOptimizationConfig({
            reason: `Optimization.resumeFromStorage replay tail produced duplicate trial number ${trialNumber}`
          })
        )
    })
    return yield* decodeUnknown({ ...checkpoint, trials }).pipe(
      Effect.mapError(() => invalid("Optimization.resumeFromStorage replay diagnostics are invalid"))
    )
  })

/** Validated execution seed recovered from a snapshot. @since 0.7.0 @category models */
export class Seed<Config> extends Data.Class<{
  readonly initialTrials: Iterable<SearchTrial.Trial<Config>>
  readonly startTrialNumber: number
}> {}

/**
 * Validates space, objective, stop-mode, and sampler compatibility before replay.
 * Checks identities, counters, and every opaque configuration before restoring the
 * sampler. Running reservations are cancelled because their workers do not survive
 * restoration. Incompatibility fails with {@link InvalidOptimizationConfig}.
 *
 * @since 0.7.0
 * @category recovery
 */
export const restore = <Space extends SearchSpace.SearchSpace>(
  space: Space,
  sampler: Sampler.Sampler,
  objectiveSpec: Metadata["objectiveSpec"],
  stopMode: Stop.Mode,
  snapshot: OptimizationSnapshot
): Effect.Effect<Seed<SearchSpace.Type<Space>>, InvalidOptimizationConfig> =>
  Effect.gen(function*() {
    const decoded = yield* validated(snapshot)
    yield* Effect.when(
      Effect.fail(invalid("Optimization.resume space fingerprint mismatch")),
      () => Bool.not(Equal.equals(decoded.spaceFingerprint, SearchSpace.fingerprint(space)))
    )
    yield* Effect.when(
      Effect.fail(invalid("Optimization.resume objective specification mismatch")),
      () => Bool.not(Schema.equivalence(Objective)(decoded.objectiveSpec, objectiveSpec))
    )
    yield* Effect.when(
      Effect.fail(invalid("Optimization.resume stop mode mismatch")),
      () => Bool.not(Equal.equals(decoded.stopMode, stopMode))
    )
    yield* Effect.when(
      Effect.fail(invalid("Optimization.resume sampler kind mismatch")),
      () => Bool.not(Schema.equivalence(Sampler.Kind)(decoded.samplerKind, sampler.kind))
    )
    const initialTrials = yield* Effect.forEach(decoded.trials, (trial) =>
      Schema.decodeUnknown(space.schema)(trial.config).pipe(
        Effect.map((config) => {
          const restored = toTrial(trial, config)
          return Match.value(SearchTrial.isState("Running")(restored.state)).pipe(
            Match.when(true, () =>
              SearchTrial.cancel(restored)),
            Match.orElse(() => restored)
          )
        }),
        Effect.mapError(() =>
          invalid(`Optimization.resume snapshot trial ${trial.trialNumber} has an invalid configuration`)
        )
      ))
    yield* Sampler.restore(sampler, decoded.samplerCheckpoint)
    return new Seed({ initialTrials, startTrialNumber: decoded.nextTrialNumber })
  }).pipe(Effect.withSpan("effect-search/OptimizationSnapshot.restore"))
