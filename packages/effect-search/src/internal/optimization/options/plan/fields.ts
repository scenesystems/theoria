/**
 * Shared plan field extraction used by both run and resume plan constructors.
 *
 * @since 0.1.0
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import type { Duration } from "effect"
import { Option } from "effect"

import type { Direction } from "../../../../Direction.js"
import type { Policy } from "../../../../Pruning.js"
import type { PriorTrial, RetrySchedule } from "../plan.js"

/**
 * Extracts common plan fields from user options, converting undefined values to omitted properties.
 *
 * @since 0.1.0
 * @category utils
 */
export const commonPlanFields = <Config>(options: {
  readonly direction?: Direction
  readonly directions?: Iterable<Direction>
  readonly pruningPolicy?: Policy
  readonly stopMode?: Stop.Mode
  readonly concurrency?: number
  readonly priorTrials?: Iterable<PriorTrial<Config>>
  readonly priorWeight?: number
  readonly maxCost?: number
  readonly evaluationsPerTrial?: number
  readonly maxDuration?: Duration.DurationInput
  readonly targetValue?: number
  readonly noImprovementWindow?: number
  readonly epsilon?: number
  readonly retrySchedule?: RetrySchedule
  readonly trialTimeout?: Duration.DurationInput
}) => ({
  ...Option.fromNullable(options.direction).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (direction) => ({ direction })
    })
  ),
  ...Option.fromNullable(options.directions).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (directions) => ({ directions })
    })
  ),
  ...Option.fromNullable(options.pruningPolicy).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (pruningPolicy) => ({ pruningPolicy })
    })
  ),
  ...Option.fromNullable(options.stopMode).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (stopMode) => ({ stopMode })
    })
  ),
  ...Option.fromNullable(options.concurrency).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (concurrency) => ({ concurrency })
    })
  ),
  ...Option.fromNullable(options.priorTrials).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (priorTrials) => ({ priorTrials })
    })
  ),
  ...Option.fromNullable(options.priorWeight).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (priorWeight) => ({ priorWeight })
    })
  ),
  ...Option.fromNullable(options.maxCost).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (maxCost) => ({ maxCost })
    })
  ),
  ...Option.fromNullable(options.evaluationsPerTrial).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (evaluationsPerTrial) => ({ evaluationsPerTrial })
    })
  ),
  ...Option.fromNullable(options.maxDuration).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (maxDuration) => ({ maxDuration })
    })
  ),
  ...Option.fromNullable(options.targetValue).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (targetValue) => ({ targetValue })
    })
  ),
  ...Option.fromNullable(options.noImprovementWindow).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (noImprovementWindow) => ({ noImprovementWindow })
    })
  ),
  ...Option.fromNullable(options.epsilon).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (epsilon) => ({ epsilon })
    })
  ),
  ...Option.fromNullable(options.retrySchedule).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (retrySchedule) => ({ retrySchedule })
    })
  ),
  ...Option.fromNullable(options.trialTimeout).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (trialTimeout) => ({ trialTimeout })
    })
  )
})
