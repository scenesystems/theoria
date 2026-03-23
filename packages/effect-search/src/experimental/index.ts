/**
 * Experimental extension points.
 *
 * These APIs are public but unstable and may change outside semver guarantees.
 *
 * @since 0.1.0
 */

import { splitByObjectiveSpec as _splitTpeTrialsByObjectiveSpec } from "../samplers/Tpe/split/index.js"

/**
 * Split completed TPE trials into above/below groups based on objective spec direction.
 *
 * @since 0.1.0
 * @category experimental
 */
export const splitTpeTrialsByObjectiveSpec = _splitTpeTrialsByObjectiveSpec

/**
 * Experimental scenario contracts reused by deterministic parity and integration suites.
 *
 * These exports are intentionally unstable and may change outside semver guarantees.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Scenarios from "./scenarios/index.js"
