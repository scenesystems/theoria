/**
 * Branded rollout count shared by repeated-execution module wrappers.
 *
 * @since 0.3.0
 */
import { Schema } from "effect"

/**
 * Validates and brands the number of rollouts or attempts a wrapper performs.
 *
 * @remarks
 * Accepted values are positive integers. Construct with `RolloutCount.make(n)`
 * (which throws a `ParseError` on invalid input) or decode with
 * `Schema.decode(RolloutCount)` to keep the failure typed.
 *
 * @since 0.3.0
 * @category schemas
 */
export const RolloutCount = Schema.Int.pipe(
  Schema.positive(),
  Schema.brand("RolloutCount")
)

/**
 * Selects a positive integer decoded and branded by the {@link RolloutCount} schema.
 * @since 0.3.0
 * @category type-level
 */
export type RolloutCount = Schema.Schema.Type<typeof RolloutCount>
