/**
 * Optimization direction — minimize or maximize an objective.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * Closed enum of optimization directions that determines how objective values
 * are compared — `"minimize"` treats lower as better, `"maximize"` treats
 * higher as better. Every comparator and ranking operation in the search
 * pipeline reads this to decide value comparison polarity.
 *
 * @see {@link Direction} extracted type
 * @see {@link defaultDirection} fallback when no direction is specified
 *
 * @since 0.1.0
 * @category schemas
 */
export const DirectionSchema = Schema.Literal("minimize", "maximize")

/**
 * Extracted type of {@link DirectionSchema} — either `"minimize"` or `"maximize"`.
 *
 * @see {@link DirectionSchema} source schema
 *
 * @since 0.1.0
 * @category type-level
 */
export type Direction = Schema.Schema.Type<typeof DirectionSchema>

/**
 * Returns `"minimize"` — the standard default in optimization literature
 * (loss minimization, error minimization). Used as the fallback whenever a
 * user or study configuration omits an explicit direction.
 *
 * @see {@link directionOrDefault} convenience wrapper that unwraps an `Option`
 *
 * @since 0.1.0
 * @category utils
 */
export const defaultDirection = (): Direction => "minimize"

/**
 * Resolves an optional user-supplied direction to a concrete value, falling
 * back to {@link defaultDirection} (`"minimize"`) when `None`. Typically
 * called during study or objective-spec construction where direction is an
 * optional configuration field.
 *
 * @see {@link defaultDirection} the fallback value
 * @see {@link DirectionSchema} valid direction values
 *
 * @since 0.1.0
 * @category utils
 */
export const directionOrDefault = (direction: Option.Option<Direction>): Direction =>
  Option.getOrElse(direction, defaultDirection)
