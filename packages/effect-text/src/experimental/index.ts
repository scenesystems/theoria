/**
 * Exposes unstable calibration APIs for evaluating text engine profiles.
 *
 * @remarks
 * These APIs are public but unstable and may change outside semver guarantees.
 *
 * @since 0.1.0
 */
import * as Arr from "effect/Array"

/**
 * Declares calibration APIs outside semver compatibility guarantees.
 *
 * @since 0.1.0
 * @category stability
 */
export const ExperimentalStability = "unstable"

/**
 * Lists experimental namespaces for tooling that discovers optional
 * calibration capabilities without importing them.
 *
 * @since 0.1.0
 * @category experimental
 */
export const ExperimentalSeams = Arr.make("Calibration")

/**
 * Unstable expected-layout corpora, profile evaluation, and parameter search.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Calibration from "./Calibration/index.js"
