/**
 * Pure constructors and state transitions for trial records.
 *
 * @since 0.1.0
 */
import { Match, Option } from "effect"
import { dual } from "effect/Function"

import type { ObjectiveValue } from "../contracts/ObjectiveValue.js"
import type { TrialError } from "../Errors/index.js"

import { Trial } from "./model.js"
import { Cancelled, Completed, Failed, Pruned, Running, type TrialState } from "./state.js"

const durationFromState = (state: TrialState, now: number): number =>
  Match.value(state).pipe(
    Match.tag("Running", ({ startedAt }) => now - startedAt),
    Match.tag("Completed", () => 0),
    Match.tag("Failed", () => 0),
    Match.tag("Pruned", () => 0),
    Match.tag("Cancelled", () => 0),
    Match.exhaustive
  )

/**
 * Creates a running trial whose elapsed duration is measured from `startedAt`.
 * The default study clock supplies Unix time in milliseconds. This constructor
 * stores the values without validating the trial number or timestamp.
 *
 * @typeParam Config - Decoded configuration retained by the new trial.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeRunning = <Config>(
  trialNumber: number,
  config: Config,
  startedAt: number
): Trial<Config> =>
  new Trial({
    trialNumber,
    config,
    state: Running({ startedAt })
  })

const completeWithMetadata = <Config>(
  self: Trial<Config>,
  value: ObjectiveValue,
  now: number,
  retryCount: number,
  cost: Option.Option<number>
): Trial<Config> =>
  new Trial({
    ...self,
    state: Completed({
      value,
      duration: durationFromState(self.state, now),
      retryCount
    }),
    ...Option.match(cost, {
      onNone: () => ({}),
      onSome: (resolvedCost) => ({ cost: resolvedCost })
    })
  })

/**
 * Records a successful objective value with a retry count of zero. A running
 * input receives the duration `now - startedAt`; any terminal input receives a
 * duration of zero. The function does not validate the current state or the
 * ordering of the timestamps.
 *
 * @remarks
 * Supports `complete(trial, value, now)` and
 * `pipe(trial, complete(value, now))`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const complete: {
  (value: ObjectiveValue, now: number): <Config>(self: Trial<Config>) => Trial<Config>
  /** @typeParam Config - Decoded configuration preserved from the input trial. */
  <Config>(self: Trial<Config>, value: ObjectiveValue, now: number): Trial<Config>
} = dual(
  3,
  <Config>(self: Trial<Config>, value: ObjectiveValue, now: number): Trial<Config> =>
    completeWithMetadata(self, value, now, 0, Option.none())
)

/**
 * Records a successful objective value and the number of retries performed
 * before that value was obtained. Duration and calling conventions match
 * {@link complete}. The retry count is stored without range validation.
 *
 * @since 0.1.0
 * @category combinators
 */
export const completeWithRetryCount: {
  (value: ObjectiveValue, now: number, retryCount: number): <Config>(self: Trial<Config>) => Trial<Config>
  /** @typeParam Config - Decoded configuration preserved from the input trial. */
  <Config>(self: Trial<Config>, value: ObjectiveValue, now: number, retryCount: number): Trial<Config>
} = dual(
  4,
  <Config>(self: Trial<Config>, value: ObjectiveValue, now: number, retryCount: number): Trial<Config> =>
    completeWithMetadata(self, value, now, retryCount, Option.none())
)

/**
 * Records a successful objective value, retry count, and optional evaluation
 * cost. `Option.none()` omits `cost`; `Option.some(value)` stores the value on
 * the trial without validating its unit, finiteness, or sign. Duration and
 * calling conventions match {@link complete}.
 *
 * @since 0.1.0
 * @category combinators
 */
export const completeWithRetryCountAndCost: {
  (value: ObjectiveValue, now: number, retryCount: number, cost: Option.Option<number>): <Config>(
    self: Trial<Config>
  ) => Trial<Config>
  /** @typeParam Config - Decoded configuration preserved from the input trial. */
  <Config>(
    self: Trial<Config>,
    value: ObjectiveValue,
    now: number,
    retryCount: number,
    cost: Option.Option<number>
  ): Trial<Config>
} = dual(
  5,
  <Config>(
    self: Trial<Config>,
    value: ObjectiveValue,
    now: number,
    retryCount: number,
    cost: Option.Option<number>
  ): Trial<Config> => completeWithMetadata(self, value, now, retryCount, cost)
)

/**
 * Records a terminal {@link TrialError}. A running input receives the duration
 * `now - startedAt`; any terminal input receives a duration of zero. The
 * function does not validate the current state or timestamp ordering.
 *
 * @remarks
 * Supports `fail(trial, error, now)` and `pipe(trial, fail(error, now))`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const fail: {
  (error: TrialError, now: number): <Config>(self: Trial<Config>) => Trial<Config>
  /** @typeParam Config - Decoded configuration preserved from the input trial. */
  <Config>(self: Trial<Config>, error: TrialError, now: number): Trial<Config>
} = dual(
  3,
  <Config>(self: Trial<Config>, error: TrialError, now: number): Trial<Config> =>
    new Trial({
      ...self,
      state: Failed({
        error,
        duration: durationFromState(self.state, now)
      })
    })
)

/**
 * Records the pruning step, policy, and reason as a terminal state. A running
 * input receives the duration `now - startedAt`; any terminal input receives a
 * duration of zero. The metadata and timestamp are stored without validation.
 *
 * @remarks
 * Supports data-first and pipeable calls.
 *
 * @since 0.1.0
 * @category combinators
 */
export const prune: {
  (step: number, reason: string, policy: string, now: number): <Config>(self: Trial<Config>) => Trial<Config>
  /** @typeParam Config - Decoded configuration preserved from the input trial. */
  <Config>(self: Trial<Config>, step: number, reason: string, policy: string, now: number): Trial<Config>
} = dual(
  5,
  <Config>(
    self: Trial<Config>,
    step: number,
    reason: string,
    policy: string,
    now: number
  ): Trial<Config> =>
    new Trial({
      ...self,
      state: Pruned({
        step,
        reason,
        policy,
        duration: durationFromState(self.state, now)
      })
    })
)

/**
 * Records cancellation without an error, timestamp, or duration. The function
 * accepts any current state and returns a new trial record.
 *
 * @typeParam Config - Decoded configuration preserved from the input trial.
 *
 * @since 0.1.0
 * @category combinators
 */
export const cancel = <Config>(self: Trial<Config>): Trial<Config> =>
  new Trial({
    ...self,
    state: Cancelled({})
  })
