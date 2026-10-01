/**
 * Completion reason tracking and resolution for optimization termination.
 *
 * @since 0.1.0
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import { Boolean as Bool, Effect, Option, Ref } from "effect"

import type * as OptimizationEvent from "../../../OptimizationEvent.js"
import type { StopRef } from "./controls.js"

const markCompletionReason = (
  completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>,
  reason: OptimizationEvent.CompletionReason
): Effect.Effect<void> =>
  Ref.update(completionReasonRef, (current) =>
    Option.match(current, {
      onNone: () => Option.some(reason),
      onSome: () => current
    }))

/**
 * Reports whether the next trial should be skipped because a stop request or completion reason has already been set.
 *
 * @since 0.1.0
 * @category guards
 */
export const shouldSkipNextTrial = (
  stopRef: StopRef,
  completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>
): Effect.Effect<boolean> =>
  Effect.all({
    stopRequest: Ref.get(stopRef),
    completionReason: Ref.get(completionReasonRef)
  }).pipe(
    Effect.map(({ stopRequest, completionReason }) =>
      Bool.or(Option.isSome(stopRequest), Option.isSome(completionReason))
    )
  )

/**
 * Records that the sampler has exhausted all feasible configurations in the search space.
 *
 * @since 0.1.0
 * @category utils
 */
export const markSpaceExhausted = (
  completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>
): Effect.Effect<void> => markCompletionReason(completionReasonRef, "spaceExhausted")

/**
 * Records that the trial budget has been fully consumed.
 *
 * @since 0.1.0
 * @category utils
 */
export const markBudgetExhausted = (
  completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>
): Effect.Effect<void> => markCompletionReason(completionReasonRef, "budgetExhausted")

/**
 * Records that the optimization has exceeded its maximum allowed wall-clock duration.
 *
 * @since 0.1.0
 * @category utils
 */
export const markDurationExceeded = (
  completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>
): Effect.Effect<void> => markCompletionReason(completionReasonRef, "durationExceeded")

/**
 * Records that a trial has achieved the user-specified target objective value.
 *
 * @since 0.1.0
 * @category utils
 */
export const markTargetReached = (
  completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>
): Effect.Effect<void> => markCompletionReason(completionReasonRef, "targetReached")

/**
 * Records that the no-improvement window has been exceeded without finding a better objective value.
 *
 * @since 0.1.0
 * @category utils
 */
export const markNoImprovement = (
  completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>
): Effect.Effect<void> => markCompletionReason(completionReasonRef, "noImprovement")

/**
 * Records that successive trials have converged and further exploration is unlikely to yield improvement.
 *
 * @since 0.1.0
 * @category utils
 */
export const markConvergence = (
  completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>
): Effect.Effect<void> => markCompletionReason(completionReasonRef, "convergence")

const completionReasonFromStopRequest = (
  stopRequest: Option.Option<Stop.Request>
): OptimizationEvent.CompletionReason =>
  Option.match(stopRequest, {
    onNone: () => "budgetExhausted",
    onSome: () => "interrupted"
  })

/**
 * Determines the final completion reason by preferring an explicit reason over a stop-request fallback.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolveCompletionReason = (
  stopRequest: Option.Option<Stop.Request>,
  completionReason: Option.Option<OptimizationEvent.CompletionReason>
): OptimizationEvent.CompletionReason =>
  Option.match(completionReason, {
    onNone: () => completionReasonFromStopRequest(stopRequest),
    onSome: (reason) => reason
  })
