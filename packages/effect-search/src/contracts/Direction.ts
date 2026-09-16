/**
 * Comparison polarity for optimization objectives.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * Decodes `"minimize"` for lower-is-better comparisons and `"maximize"` for
 * higher-is-better comparisons.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DirectionSchema = Schema.Literal("minimize", "maximize")

/**
 * Comparison polarity shared by ranking, incumbent selection, and Pareto operations.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Direction = Schema.Schema.Type<typeof DirectionSchema>

/**
 * Decodes an ordered set of objective comparison directions.
 *
 * @since 0.5.0
 * @category schemas
 */
export const DirectionVectorSchema = Schema.Array(DirectionSchema)

/**
 * Ordered comparison directions for a vector objective.
 *
 * @since 0.5.0
 * @category type-level
 */
export type DirectionVector = Schema.Schema.Type<typeof DirectionVectorSchema>

/**
 * Supplies `"minimize"` when a study does not declare a direction.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultDirection = (): Direction => "minimize"

/**
 * Extracts a direction or returns `"minimize"` for `Option.none()`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const directionOrDefault = (direction: Option.Option<Direction>): Direction =>
  Option.getOrElse(direction, defaultDirection)
