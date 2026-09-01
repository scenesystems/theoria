/**
 * Consumer entry point for inspecting TPE trial partitioning and importing
 * deterministic scenario search spaces used to test or prototype integrations.
 *
 * @remarks
 * These APIs expose implementation/parity seams rather than the supported
 * optimization workflow. They are public but unstable and may change outside
 * semver guarantees; production studies should use the stable Sampler, Study,
 * and SearchSpace entry points instead.
 *
 * @since 0.1.0
 */

import { splitByObjectiveSpec as _splitTpeTrialsByObjectiveSpec } from "../samplers/Tpe/split/index.js"

/**
 * Partitions completed trials into TPE's better (`below`) and remaining
 * (`above`) observations for a single- or multi-objective specification.
 *
 * @remarks
 * The function is exposed for parity testing and may change without a
 * major-version release. It is the same implementation used internally by
 * the TPE sampler.
 *
 * @since 0.1.0
 * @category experimental
 */
export const splitTpeTrialsByObjectiveSpec = _splitTpeTrialsByObjectiveSpec

/**
 * Search-space fixtures whose schemas and bounds define deterministic test scenarios.
 * These declarations may change without a major-version release.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Scenarios from "./scenarios/index.js"
