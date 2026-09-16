/**
 * Search trial records, lifecycle states, constructors, and transitions.
 *
 * @since 0.7.0
 * @module
 */
import * as StudyTrial from "@scenesystems/effect-study/Trial"
import { Data, Match, Option, Schema } from "effect"
import { dual } from "effect/Function"

import { Value } from "./Objective.js"
import { TrialError } from "./SearchError.js"

const CompletionMetadata = Schema.Struct({
  retryCount: Schema.Number,
  evaluationCount: Schema.optional(Schema.Number),
  variance: Schema.optional(Schema.Number)
})

const CompletedState = Schema.Struct({
  ...StudyTrial.Completed(Value).fields,
  ...CompletionMetadata.fields
})

const NumericCompletedState = Schema.Struct({
  ...StudyTrial.Completed(Schema.Number).fields,
  ...CompletionMetadata.fields
})

/** Scalar completion metadata. @since 0.7.0 @category models */
export type NumericCompletedState = typeof NumericCompletedState.Type

/**
 * Search-specific trial state persisted by snapshots and storage.
 *
 * @since 0.7.0
 * @category schemas
 */
export const State = Schema.Union(
  StudyTrial.Running,
  CompletedState,
  StudyTrial.Failed(TrialError),
  Schema.TaggedStruct("Pruned", {
    step: Schema.Number,
    reason: Schema.String,
    policy: Schema.String,
    duration: Schema.Number
  }),
  StudyTrial.Cancelled
)

/** A running or terminal search trial state. @since 0.7.0 @category models */
export type State = typeof State.Type

const States = Data.taggedEnum<State>()

/** Creates a running state. @since 0.7.0 @category constructors */
export const Running = States.Running
/** Creates a completed state. @since 0.7.0 @category constructors */
export const Completed = States.Completed
/** Creates a failed state. @since 0.7.0 @category constructors */
export const Failed = States.Failed
/** Creates a pruned state. @since 0.7.0 @category constructors */
export const Pruned = States.Pruned
/** Creates a cancelled state. @since 0.7.0 @category constructors */
export const Cancelled = States.Cancelled
/** Narrows a state by tag. @since 0.7.0 @category guards */
export const isState = States.$is
/** Exhaustively matches a state. @since 0.7.0 @category pattern-matching */
export const matchState = States.$match

/** A successful terminal state. @since 0.7.0 @category models */
export type CompletedState = Data.TaggedEnum.Value<State, "Completed">

/**
 * Specializes the generic effect-study trial schema with search lifecycle state.
 *
 * @since 0.7.0
 * @category schema-factories
 */
export const Trial = <Config extends Schema.Schema.All>(config: Config) => StudyTrial.Trial(config, State)

/** Search trial data with its decoded configuration type preserved. @since 0.7.0 @category models */
export type Trial<Config> = StudyTrial.Trial<Config, State>

/** A successfully completed search trial. @since 0.7.0 @category models */
export type CompletedTrial<Config> = StudyTrial.Trial<Config, CompletedState>

/** A completed scalar-objective search trial. @since 0.7.0 @category models */
export type NumericCompletedTrial<Config> = StudyTrial.Trial<Config, NumericCompletedState>

/** Creates a running trial. @since 0.7.0 @category constructors */
export const makeRunning = <Config>(trialNumber: number, config: Config, startedAt: number): Trial<Config> =>
  StudyTrial.makeRunning(trialNumber, config, startedAt)

const durationFromState = (state: State, now: number): number =>
  Match.value(state).pipe(
    Match.tag("Running", (running) => StudyTrial.duration(running, now)),
    Match.orElse(() => 0)
  )

const completeWithMetadata = <Config>(
  self: Trial<Config>,
  value: Value,
  now: number,
  retryCount: number,
  cost: Option.Option<number>
): Trial<Config> =>
  Data.struct({
    ...self,
    state: Completed({ value, duration: durationFromState(self.state, now), retryCount }),
    ...Option.match(cost, {
      onNone: () => ({}),
      onSome: (resolvedCost) => ({ cost: resolvedCost })
    })
  })

/** Completes a trial with no retries. @since 0.7.0 @category combinators */
export const complete: {
  (value: Value, now: number): <Config>(self: Trial<Config>) => Trial<Config>
  <Config>(self: Trial<Config>, value: Value, now: number): Trial<Config>
} = dual(
  3,
  <Config>(self: Trial<Config>, value: Value, now: number) => completeWithMetadata(self, value, now, 0, Option.none())
)

/** Completes a trial with its retry count. @since 0.7.0 @category combinators */
export const completeWithRetryCount: {
  (value: Value, now: number, retryCount: number): <Config>(self: Trial<Config>) => Trial<Config>
  <Config>(self: Trial<Config>, value: Value, now: number, retryCount: number): Trial<Config>
} = dual(
  4,
  <Config>(self: Trial<Config>, value: Value, now: number, retryCount: number) =>
    completeWithMetadata(self, value, now, retryCount, Option.none())
)

/** Completes a trial with retry and cost metadata. @since 0.7.0 @category combinators */
export const completeWithRetryCountAndCost: {
  (
    value: Value,
    now: number,
    retryCount: number,
    cost: Option.Option<number>
  ): <Config>(self: Trial<Config>) => Trial<Config>
  <Config>(
    self: Trial<Config>,
    value: Value,
    now: number,
    retryCount: number,
    cost: Option.Option<number>
  ): Trial<Config>
} = dual(
  5,
  <Config>(self: Trial<Config>, value: Value, now: number, retryCount: number, cost: Option.Option<number>) =>
    completeWithMetadata(self, value, now, retryCount, cost)
)

/** Records a terminal trial failure. @since 0.7.0 @category combinators */
export const fail: {
  (error: TrialError, now: number): <Config>(self: Trial<Config>) => Trial<Config>
  <Config>(self: Trial<Config>, error: TrialError, now: number): Trial<Config>
} = dual(
  3,
  <Config>(self: Trial<Config>, error: TrialError, now: number) =>
    Match.value(self.state).pipe(
      Match.tag("Running", (state) => StudyTrial.fail(Data.struct({ ...self, state }), error, now)),
      Match.orElse(() => Data.struct({ ...self, state: Failed({ error, duration: 0 }) }))
    )
)

/** Records a terminal pruning decision. @since 0.7.0 @category combinators */
export const prune: {
  (step: number, reason: string, policy: string, now: number): <Config>(self: Trial<Config>) => Trial<Config>
  <Config>(self: Trial<Config>, step: number, reason: string, policy: string, now: number): Trial<Config>
} = dual(
  5,
  <Config>(self: Trial<Config>, step: number, reason: string, policy: string, now: number) =>
    Data.struct({ ...self, state: Pruned({ step, reason, policy, duration: durationFromState(self.state, now) }) })
)

/** Records terminal cancellation. @since 0.7.0 @category combinators */
export const cancel = <Config>(self: Trial<Config>): Trial<Config> => StudyTrial.cancel(self)

/** Narrows a completed trial to a scalar result. @since 0.7.0 @category guards */
export const isNumericCompleted = <Config>(trial: CompletedTrial<Config>): trial is NumericCompletedTrial<Config> =>
  Match.value(trial.state.value).pipe(
    Match.when(Match.number, () => true),
    Match.orElse(() => false)
  )
