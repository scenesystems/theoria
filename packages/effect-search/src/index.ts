/**
 * Builds typed search spaces and samplers, then executes resumable single- or
 * multi-objective studies as Effect programs.
 *
 * @remarks
 * Define parameter domains with `SearchSpace`, choose a `Sampler`, and run the
 * resulting plan through `Study`. `Trial` and `StudyEvent` expose lifecycle
 * state, while `Cache`, `Scheduler`, and `Pareto` add persistence,
 * multi-fidelity scheduling, and multi-objective analysis when needed.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Shared objective, metric, storage, and study contracts.
 *
 * @since 0.1.0
 * @category contracts
 */
export * as Contracts from "./contracts/index.js"

/**
 * Cache descriptors, services, and layers for evaluated objectives.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Cache from "./Cache/index.js"

/**
 * Errors returned by search-space, sampler, scheduler, and study operations.
 *
 * @since 0.1.0
 * @category errors
 */
export * as Errors from "./Errors/index.js"

/**
 * APIs that may change without a major-version release.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Experimental from "./experimental/index.js"

/**
 * Multi-objective dominance, frontier, and hypervolume.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Pareto from "./Pareto/index.js"

/**
 * Random, TPE, MOTPE, and grid strategies for suggesting configurations.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Sampler from "./Sampler/index.js"

/**
 * Parallel trial scheduling.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Scheduler from "./Scheduler/index.js"

/**
 * Parameter space definition and compilation.
 *
 * @since 0.1.0
 * @category domains
 */
export * as SearchSpace from "./SearchSpace/index.js"

/**
 * Optimization orchestration, event streaming, snapshots, and persistence.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Study from "./Study/index.js"

/**
 * Lifecycle event types for progress monitoring.
 *
 * @since 0.1.0
 * @category domains
 */
export * as StudyEvent from "./StudyEvent/index.js"

/**
 * Trial data types and state machine.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Trial from "./Trial/index.js"
