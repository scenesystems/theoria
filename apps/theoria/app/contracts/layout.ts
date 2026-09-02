import { Schema } from "effect"

/**
 * Content card border geometry.
 *
 * - `rounded`: full border with rounded corners (default)
 * - `left-accent`: left border only, square corners
 *
 * @since 0.1.0
 */
export const ContentCardShape = Schema.Literal("rounded", "left-accent")

/**
 * @since 0.1.0
 */
export type ContentCardShape = typeof ContentCardShape.Type

/**
 * Content card density controlling inner gap and padding.
 *
 * @since 0.1.0
 */
export const ContentCardDensity = Schema.Literal("compact", "standard")

/**
 * @since 0.1.0
 */
export type ContentCardDensity = typeof ContentCardDensity.Type
