/**
 * Experimental extension points.
 *
 * These APIs are public but unstable and may change outside semver guarantees.
 *
 * @since 0.1.0
 */
import * as Arr from "effect/Array"

/**
 * Stability lane for the Experimental namespace.
 *
 * @since 0.1.0
 * @category stability
 */
export const ExperimentalStability = "experimental"

/**
 * Experimental module catalog reserved for unstable integration work.
 *
 * @since 0.1.0
 * @category experimental
 */
export const ExperimentalSeams = Arr.make("Calibration")

/**
 * Experimental calibration corpora and engine-profile evaluation helpers.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Calibration from "./Calibration/index.js"
