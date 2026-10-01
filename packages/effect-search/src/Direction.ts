/**
 * Comparison polarity for optimization objectives.
 *
 * @since 0.1.0
 * @module
 */
import { Option, Schema } from "effect"

/**
 * Comparison polarity accepted by ranking and Pareto operations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Direction = Schema.Literal("minimize", "maximize")

/**
 * Comparison polarity decoded by {@link Direction}.
 *
 * @since 0.1.0
 * @category models
 */
export type Direction = typeof Direction.Type

/** Lower-is-better comparison. @since 0.1.0 @category constants */
export const minimize: Direction = "minimize"

/** Higher-is-better comparison. @since 0.1.0 @category constants */
export const maximize: Direction = "maximize"

/**
 * Extracts a direction, defaulting to {@link minimize}.
 *
 * @since 0.1.0
 * @category combinators
 */
export const orDefault = (direction: Option.Option<Direction>): Direction => Option.getOrElse(direction, () => minimize)
