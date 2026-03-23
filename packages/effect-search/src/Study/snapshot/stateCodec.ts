/**
 * Codec schemas for serializing and deserializing trial state in snapshots.
 *
 * @since 0.1.0
 */
import type { Data } from "effect"
import { Match, Option, Schema } from "effect"

import { ObjectiveValueSchema } from "../../contracts/ObjectiveValue.js"
import { TrialError } from "../../Errors/index.js"
import * as Trial from "../../Trial/index.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export const TrialStateSnapshotSchema = Schema.Union(
  Schema.TaggedStruct("Running", {
    startedAt: Schema.Number
  }),
  Schema.TaggedStruct("Completed", {
    value: ObjectiveValueSchema,
    duration: Schema.Number,
    retryCount: Schema.optional(Schema.Number),
    evaluationCount: Schema.optional(Schema.Number),
    variance: Schema.optional(Schema.Number)
  }),
  Schema.TaggedStruct("Failed", {
    error: TrialError,
    duration: Schema.Number
  }),
  Schema.TaggedStruct("Pruned", {
    step: Schema.Number,
    reason: Schema.String,
    policy: Schema.String,
    duration: Schema.Number
  }),
  Schema.TaggedStruct("Cancelled", {
    cancelled: Schema.optional(Schema.Literal(true))
  })
)

/**
 * @since 0.1.0
 * @category type-level
 */
export type TrialStateSnapshot = Schema.Schema.Type<typeof TrialStateSnapshotSchema>

/**
 * @since 0.1.0
 * @category schemas
 */
export const SnapshotTrialSchema = Schema.Struct({
  trialNumber: Schema.Number,
  config: Schema.Unknown,
  state: TrialStateSnapshotSchema,
  cost: Schema.optional(Schema.Number),
  prior: Schema.optional(Schema.Literal(true))
})

/**
 * @since 0.1.0
 * @category type-level
 */
export type SnapshotTrial = Schema.Schema.Type<typeof SnapshotTrialSchema>

const runningStateToSnapshot = ({
  startedAt
}: Data.TaggedEnum.Value<Trial.TrialState, "Running">): TrialStateSnapshot => ({
  _tag: "Running",
  startedAt
})

const completedStateToSnapshot = ({
  value,
  duration,
  retryCount,
  evaluationCount,
  variance
}: Data.TaggedEnum.Value<Trial.TrialState, "Completed">): TrialStateSnapshot => ({
  _tag: "Completed",
  value,
  duration,
  retryCount,
  evaluationCount,
  variance
})

const failedStateToSnapshot = ({
  error,
  duration
}: Data.TaggedEnum.Value<Trial.TrialState, "Failed">): TrialStateSnapshot => ({
  _tag: "Failed",
  error,
  duration
})

const prunedStateToSnapshot = ({
  step,
  reason,
  policy,
  duration
}: Data.TaggedEnum.Value<Trial.TrialState, "Pruned">): TrialStateSnapshot => ({
  _tag: "Pruned",
  step,
  reason,
  policy,
  duration
})

const cancelledStateToSnapshot = ({
  cancelled
}: Data.TaggedEnum.Value<Trial.TrialState, "Cancelled">): TrialStateSnapshot =>
  Match.value(cancelled).pipe(
    Match.when(true, (value): TrialStateSnapshot => ({ _tag: "Cancelled", cancelled: value })),
    Match.orElse((): TrialStateSnapshot => ({ _tag: "Cancelled" }))
  )

/**
 * @since 0.1.0
 * @category codecs
 */
export const stateToSnapshot = (state: Trial.TrialState): TrialStateSnapshot =>
  Trial.matchState({
    Running: runningStateToSnapshot,
    Completed: completedStateToSnapshot,
    Failed: failedStateToSnapshot,
    Pruned: prunedStateToSnapshot,
    Cancelled: cancelledStateToSnapshot
  })(state)

/**
 * @since 0.1.0
 * @category codecs
 */
export const snapshotToState = (state: TrialStateSnapshot): Trial.TrialState =>
  Match.value(state).pipe(
    Match.tag("Running", ({ startedAt }) => Trial.Running({ startedAt })),
    Match.tag("Completed", ({ value, duration, retryCount, evaluationCount, variance }) =>
      Trial.Completed({
        value,
        duration,
        retryCount: Option.fromNullable(retryCount).pipe(Option.getOrElse(() => 0)),
        evaluationCount: Option.fromNullable(evaluationCount).pipe(Option.getOrElse(() => 1)),
        ...Option.fromNullable(variance).pipe(
          Option.match({
            onNone: () => ({}),
            onSome: (resolvedVariance) => ({ variance: resolvedVariance })
          })
        )
      })),
    Match.tag("Failed", ({ error, duration }) => Trial.Failed({ error, duration })),
    Match.tag("Pruned", ({ step, reason, policy, duration }) => Trial.Pruned({ step, reason, policy, duration })),
    Match.tag("Cancelled", ({ cancelled }) =>
      Match.value(cancelled).pipe(
        Match.when(true, (value) => Trial.Cancelled({ cancelled: value })),
        Match.orElse(() => Trial.Cancelled({}))
      )),
    Match.exhaustive
  )

/**
 * @since 0.1.0
 * @category codecs
 */
export const trialToSnapshot = <Config>(trial: Trial.Trial<Config>): SnapshotTrial => ({
  trialNumber: trial.trialNumber,
  config: trial.config,
  state: stateToSnapshot(trial.state),
  ...Option.fromNullable(trial.cost).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (cost) => ({ cost })
    })
  ),
  ...Match.value(trial.prior).pipe(
    Match.when(true, (prior) => ({ prior })),
    Match.orElse(() => ({}))
  )
})

/**
 * @since 0.1.0
 * @category codecs
 */
export const snapshotToTrial = <Config>(trial: SnapshotTrial, config: Config): Trial.Trial<Config> =>
  new Trial.Trial({
    trialNumber: trial.trialNumber,
    config,
    state: snapshotToState(trial.state),
    ...Option.fromNullable(trial.cost).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (cost) => ({ cost })
      })
    ),
    ...Match.value(trial.prior).pipe(
      Match.when(true, (prior) => ({ prior })),
      Match.orElse(() => ({}))
    )
  })

/**
 * @since 0.1.0
 * @category utils
 */
export const stateDuration = (state: TrialStateSnapshot): number =>
  Match.value(state).pipe(
    Match.tag("Running", () => 0),
    Match.tag("Completed", ({ duration }) => duration),
    Match.tag("Failed", ({ duration }) => duration),
    Match.tag("Pruned", ({ duration }) => duration),
    Match.tag("Cancelled", () => 0),
    Match.exhaustive
  )
