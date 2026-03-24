/**
 * Shared plan field extraction used by both optimize and resume plan constructors.
 *
 * @since 0.1.0
 */
import type { Duration } from "effect"
import { Option } from "effect"

import type { Direction } from "../../../contracts/Direction.js"
import type { PruningPolicy, StopMode } from "../../runtime/pruning.js"
import type { PriorTrial, RetrySchedule } from "../model.js"

/**
 * Extracts common plan fields from user options, converting undefined values to omitted properties.
 *
 * @since 0.1.0
 * @category utils
 */
export const commonPlanFields = <Config>(options: {
  readonly direction?: Direction
  readonly directions?: ReadonlyArray<Direction>
  readonly pruningPolicy?: PruningPolicy
  readonly stopMode?: StopMode
  readonly concurrency?: number
  readonly priorTrials?: ReadonlyArray<PriorTrial<Config>>
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
