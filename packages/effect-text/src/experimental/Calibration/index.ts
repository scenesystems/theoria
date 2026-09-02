/**
 * Experimental comparison of candidate engine profiles against expected line geometry.
 *
 * These exports are intentionally unstable and may change outside semver guarantees.
 *
 * @since 0.2.0
 */

/**
 * Marks calibration schemas, evaluation, and search as outside semver guarantees.
 *
 * @since 0.1.0
 * @category stability
 */
export const CalibrationStability = "unstable"

/**
 * Candidate profiles, expected line geometry, weighted losses, and resumable study artifacts.
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
 * profile optimization runs.
 *
 * @since 0.2.0
 */
export * from "./search.js"
