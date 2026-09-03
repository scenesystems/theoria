/**
 * Composes typed parameter spaces with sampling and Effect-based study execution.
 *
 * @remarks
 * `SearchSpace` values carry configuration decoders and sampler metadata. A
 * `Sampler` selects candidate configurations, while `Study` owns evaluation,
 * lifecycle events, results, and restoration.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Carries objective definitions and artifact-envelope contracts across package boundaries.
 *
 * @since 0.1.0
 * @category contracts
 */
export * as Contracts from "./contracts/index.js"

/**
 * Caches schema-encoded values in memory, on a filesystem, or in SQLite-compatible storage.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Cache from "./Cache/index.js"

/**
 * Identifies expected failures from search-space compilation, sampling, and study execution.
 *
 * @since 0.1.0
 * @category errors
 */
export * as Errors from "./Errors/index.js"

/**
 * Exposes unstable TPE partitioning and deterministic test scenarios.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Experimental from "./experimental/index.js"

/**
 * Compares objective vectors and computes Pareto frontiers and two-dimensional hypervolume.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Pareto from "./Pareto/index.js"

/**
 * Defines suggestion strategies, per-trial context, and sampler checkpoint contracts.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Sampler from "./Sampler/index.js"

/**
 * Assigns resource budgets and promotion rounds for successive-halving studies.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Scheduler from "./Scheduler/index.js"

/**
 * Compiles annotated Effect Schemas into typed spaces used for sampling and decoding.
 *
 * @since 0.1.0
 * @category domains
 */
export * as SearchSpace from "./SearchSpace/index.js"

/**
 * Runs studies and exposes streaming, ask/tell, snapshot, resume, and persistence APIs.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Study from "./Study/index.js"

/**
 * Defines the tagged lifecycle events emitted by studies and bracket schedulers.
 *
 * @since 0.1.0
 * @category domains
 */
export * as StudyEvent from "./StudyEvent/index.js"

/**
 * Tracks evaluated configurations through running and terminal lifecycle states.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Trial from "./Trial/index.js"
