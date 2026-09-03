/**
 * Rollout-scoped cache partitioning for concurrent candidate evaluations.
 *
 * @since 0.1.0
 */
import { Effect, FiberRef, Option } from "effect"

/**
 * Identifies the current candidate when a module evaluates several candidates.
 * The value is absent outside a rollout scope. Child fibers inherit the value
 * present when they are forked.
 *
 * @since 0.1.0
 * @category refs
 */
export const RolloutRef: FiberRef.FiberRef<Option.Option<number>> = FiberRef.unsafeMake(Option.none())

/**
 * Assigns a rollout index while evaluating `effect`.
 *
 * @remarks
 * The previous {@link RolloutRef} value is restored when the effect ends. The
 * effect's success, typed error, and service requirement channels are unchanged.
 *
 * @param index - Cache partition used by the candidate evaluation.
 * @param effect - Evaluation that reads the rollout index directly or through
 *   {@link buildDspCacheKey}.
 * @typeParam A - Success value returned by the evaluation.
 * @typeParam E - Expected failure preserved from the evaluation.
 * @typeParam R - Services required by the evaluation.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withRollout = <A, E, R>(
  index: number,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => Effect.locally(effect, RolloutRef, Option.some(index))
