/**
 * Immutable Trial data model pairing a sampled configuration with its lifecycle state.
 *
 * @since 0.1.0
 */
import { Data, Match, Option } from "effect"
import { dual } from "effect/Function"

import type { ObjectiveValue } from "../contracts/ObjectiveValue.js"
import type { TrialError } from "../Errors/index.js"

import { Cancelled, Completed, Failed, Pruned, type TrialState } from "./state.js"

const durationFromState = (state: TrialState, now: number): number =>
  Match.value(state).pipe(
    Match.tag("Running", ({ startedAt }) => now - startedAt),
    Match.tag("Completed", () => 0),
    Match.tag("Failed", () => 0),
    Match.tag("Pruned", () => 0),
    Match.tag("Cancelled", () => 0),
    Match.exhaustive
  )

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
 * Immutable record pairing a sampler-suggested configuration with its
 * lifecycle state and sequential trial number. A trial progresses through
 * the {@link TrialState} state machine — beginning as `Running` and
 * transitioning exactly once to a terminal state via the noun-owned
 * lifecycle combinators on {@link Trial}. Because `Trial` extends
 * `Data.Class`, instances use structural equality and are safe to store in
 * `HashMap`.
 *
 * @see {@link TrialState} for the five lifecycle variants
 * @see {@link Trial.run} for the sole entry point that creates a running trial
 *
 * @since 0.1.0
 * @category models
 */
export class Trial<Config> extends Data.Class<{
  readonly trialNumber: number
  readonly config: Config
  readonly state: TrialState
  readonly cost?: number
  readonly prior?: true
}> {
  /**
   * Constructs a running trial from a sampler-suggested configuration and start timestamp.
   *
   * @since 0.3.0
   * @category constructors
   */
  static run<Config>(trialNumber: number, config: Config, startedAt: number): Trial<Config> {
    return new Trial({
      trialNumber,
      config,
      state: {
        _tag: "Running",
        startedAt
      }
    })
  }
}

/**
 * Noun-owned lifecycle combinators for trial state transitions.
 *
 * @since 0.3.0
 * @category constructors
 */
export namespace Trial {
  /**
   * Transition a running trial to `Completed`.
   *
   * @since 0.3.0
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
   * Transition a running trial to `Completed`, recording retry count.
   *
   * @since 0.3.0
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
   * Transition a running trial to `Completed`, recording retries and optional cost.
   *
   * @since 0.3.0
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
   * Transition a running trial to `Failed`.
   *
   * @since 0.3.0
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
   * Transition a running trial to `Pruned`.
   *
   * @since 0.3.0
   * @category combinators
   */
  export const prune: {
    (step: number, reason: string, policy: string, now: number): <Config>(self: Trial<Config>) => Trial<Config>
    <Config>(self: Trial<Config>, step: number, reason: string, policy: string, now: number): Trial<Config>
  } = dual(
    5,
    <Config>(self: Trial<Config>, step: number, reason: string, policy: string, now: number): Trial<Config> =>
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
   * Transition a running trial to `Cancelled`.
   *
   * @since 0.3.0
   * @category combinators
   */
  export const cancel = <Config>(self: Trial<Config>): Trial<Config> =>
    new Trial({
      ...self,
      state: Cancelled({})
    })
}
