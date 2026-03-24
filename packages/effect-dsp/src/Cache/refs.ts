/**
 * Fiber-local rollout identity for cache key diversity and composition
 * wrapper isolation.
 *
 * @since 0.0.0
 */
import { Effect, FiberRef, Option } from "effect"

/**
 * Fiber-local rollout index set by `bestOfN` to distinguish parallel
 * candidate evaluations. Defaults to `Option.none()` when not inside
 * a rollout context.
 *
 * @see {@link withRollout} — scoped setter for this ref
 *
 * @since 0.0.0
 * @category refs
 */
export const RolloutRef: FiberRef.FiberRef<Option.Option<number>> = FiberRef.unsafeMake(Option.none())

/**
 * Run an effect with `RolloutRef` set to the given index. Scoped via
 * `Effect.locally` so the value is visible only within the effect and
 * its children.
 *
 * @see {@link RolloutRef} — the underlying fiber-local ref
 *
 * @since 0.0.0
 * @category combinators
 */
export const withRollout = <A, E, R>(
  index: number,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => Effect.locally(effect, RolloutRef, Option.some(index))
