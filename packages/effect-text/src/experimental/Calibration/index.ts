/**
 * Experimental calibration helpers for engine-profile work.
 *
 * These exports are intentionally unstable and may change outside semver guarantees.
 *
 * @since 0.2.0
 */

/**
 * Stability lane for the experimental calibration module.
 *
 * @since 0.1.0
 * @category stability
 */
export const CalibrationStability = "unstable"

/**
 * Public schemas and schema-derived types for calibration corpora and reports.
 *
 * @since 0.2.0
 */
export * from "./schema.js"

/**
 * Effectful profile evaluation built on the existing prepare/layout split.
 *
 * @since 0.2.0
 */
export * from "./evaluation.js"

/**
 * effect-search-backed search-space construction, snapshot artifacts, and
 * profile optimization helpers.
 *
 * @since 0.2.0
 */
export * from "./search.js"
