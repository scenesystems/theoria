/**
 * Monotonic cache generations for widths measured against changing browser fonts.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

/**
 * Non-negative generation counter included in browser width-cache keys.
 *
 * @since 0.2.0
 * @category schemas
 */
export const FontReadinessRevision = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0)
)

/**
 * Width-cache generation advanced after browser font availability changes.
 *
 * @since 0.2.0
 * @category models
 */
export type FontReadinessRevisionType = typeof FontReadinessRevision.Type

/**
 * Returns the initial browser font-readiness revision.
 *
 * @since 0.2.0
 * @category freshness
 */
export const initialFontReadinessRevision = (): FontReadinessRevisionType => 0

/**
 * Advances the browser font-readiness revision.
 *
 * @remarks
 * Increment the revision when browser font readiness changes in a way that can
 * invalidate cached widths.
 *
 * @since 0.2.0
 * @category freshness
 */
export const incrementFontReadinessRevision = (
  revision: FontReadinessRevisionType
): FontReadinessRevisionType => revision + 1
