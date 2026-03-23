/**
 * Trial lifecycle transitions and duration computations.
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
 * The sole entry point for trial creation. Produces a {@link Trial} in the
 * `Running` state with the given sampler-suggested configuration and start
 * timestamp. All subsequent state transitions flow through the other
 * lifecycle functions in this module.
 *
 * @see {@link Trial} for the returned record type
 * @see {@link Running} for the initial state constructor
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
 * Transitions a running trial to the `Completed` terminal state, recording
 * the objective value and computing elapsed duration from the `Running`
 * start time. Supports both data-first `complete(trial, value, now)` and
 * pipeable `pipe(trial, complete(value, now))` calling conventions.
 *
 * @see {@link Trial} for the trial record
 * @see {@link Completed} for the target state constructor
 * @see {@link completeWithRetryCount} to also record retry metadata
 *
 * @since 0.1.0
 * @category combinators
 */
export const complete: {
  (value: ObjectiveValue, now: number): <Config>(self: Trial<Config>) => Trial<Config>
  <Config>(self: Trial<Config>, value: ObjectiveValue, now: number): Trial<Config>
} = dual(
  3,
  <Config>(self: Trial<Config>, value: ObjectiveValue, now: number): Trial<Config> =>
    completeWithMetadata(self, value, now, 0, Option.none())
)

/**
 * Like {@link complete} but additionally records how many retries the
 * objective function required before succeeding. Useful for diagnosing
 * flaky evaluations or computing retry-adjusted cost.
 *
 * @see {@link complete} for the zero-retry convenience variant
 * @see {@link completeWithRetryCountAndCost} to also attach an evaluation cost
 *
 * @since 0.1.0
 * @category combinators
 */
export const completeWithRetryCount: {
  (value: ObjectiveValue, now: number, retryCount: number): <Config>(self: Trial<Config>) => Trial<Config>
  <Config>(self: Trial<Config>, value: ObjectiveValue, now: number, retryCount: number): Trial<Config>
} = dual(
  4,
  <Config>(self: Trial<Config>, value: ObjectiveValue, now: number, retryCount: number): Trial<Config> =>
    completeWithMetadata(self, value, now, retryCount, Option.none())
)

/**
 * The most complete form of the completion transition — records the objective
 * value, retry count, and an optional monetary/compute cost for the
 * evaluation. When cost is `Option.none()`, no cost field is set on the
 * resulting trial.
 *
 * @see {@link complete} for the minimal convenience variant
 * @see {@link completeWithRetryCount} for completion without cost tracking
 * @see {@link Trial} for how the `cost` field is stored on the record
 *
 * @since 0.1.0
 * @category combinators
 */
export const completeWithRetryCountAndCost: {
  (value: ObjectiveValue, now: number, retryCount: number, cost: Option.Option<number>): <Config>(
    self: Trial<Config>
  ) => Trial<Config>
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
 * Transitions a running trial to the `Failed` terminal state, capturing
 * the {@link TrialError} and elapsed duration. The error is preserved for
 * post-hoc diagnostics without affecting the study's other trials.
 *
 * @see {@link Trial} for the trial record
 * @see {@link Failed} for the target state constructor
 *
 * @since 0.1.0
 * @category combinators
 */
export const fail: {
  (error: TrialError, now: number): <Config>(self: Trial<Config>) => Trial<Config>
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
 * Transitions a running trial to the `Pruned` terminal state when an
 * early-stopping policy (e.g. median pruner, percentile pruner) determines
 * the trial is unlikely to improve beyond the current best. Records the
 * intermediate step, a human-readable reason, and the policy name so
 * pruning decisions can be audited after the study completes.
 *
 * @see {@link Trial} for the trial record
 * @see {@link Pruned} for the target state constructor
 *
 * @since 0.1.0
 * @category combinators
 */
export const prune: {
  (step: number, reason: string, policy: string, now: number): <Config>(self: Trial<Config>) => Trial<Config>
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
 * Transitions a running trial to the `Cancelled` terminal state. This
 * occurs on external interruption — user abort, timeout, or study-level
 * cancellation. Unlike {@link fail}, no error is captured because the
 * interruption is intentional and does not indicate a defect.
 *
 * @see {@link Trial} for the trial record
 * @see {@link Cancelled} for the target state constructor
 *
 * @since 0.1.0
 * @category combinators
 */
export const cancel = <Config>(self: Trial<Config>): Trial<Config> =>
  new Trial({
    ...self,
    state: Cancelled({})
  })
