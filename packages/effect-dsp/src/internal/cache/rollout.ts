/**
 * Rollout-scoped cache partitioning for concurrent candidate evaluations.
 *
 * @since 0.1.0
 */
import { Context, Effect, Option } from "effect"

/**
 * Identifies the current candidate when a module evaluates several candidates.
 * The value is absent outside a rollout scope. Child fibers inherit the value
 * present when they are forked.
 *
 * @since 0.1.0
 * @category refs
 */
export const RolloutRef = Context.Reference<Option.Option<number>>(
  "@scenesystems/effect-dsp/internal/cache/RolloutRef",
  {
    defaultValue: Option.none
  }
)

/**
 * Assigns a rollout index while evaluating `effect`.
 *
 * @remarks
 * The previous rollout partition is restored when the effect ends. The
 * effect's success, typed error, and service requirement channels are unchanged.
 *
 * @param index - Cache partition used by the candidate evaluation.
 * @param effect - Evaluation that reads the rollout index directly or through
 *   cache-key construction.
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
): Effect.Effect<A, E, R> => Effect.provideService(effect, RolloutRef, Option.some(index))
