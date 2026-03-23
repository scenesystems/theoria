/**
 * Domain contracts shared across modules.
 *
 * @since 0.1.0
 */
export * as Contracts from "./contracts/index.js"

/**
 * Shared cache authority and descriptor/layer primitives.
 *
 * @since 0.1.0
 */
export * as Cache from "./Cache/index.js"

/**
 * Typed error hierarchy.
 *
 * @since 0.1.0
 */
export * as Errors from "./Errors/index.js"

/**
 * Unstable features with fixture-backed tests.
 *
 * @since 0.1.0
 */
export * as Experimental from "./experimental/index.js"

/**
 * Multi-objective dominance, frontier, and hypervolume.
 *
 * @since 0.1.0
 */
export * as Pareto from "./Pareto/index.js"

/**
 * Algorithm strategies for suggesting configurations.
 *
 * @since 0.1.0
 */
export * as Sampler from "./Sampler/index.js"

/**
 * Parallel trial scheduling.
 *
 * @since 0.1.0
 */
export * as Scheduler from "./Scheduler/index.js"

/**
 * Parameter space definition and compilation.
 *
 * @since 0.1.0
 */
export * as SearchSpace from "./SearchSpace/index.js"

/**
 * Optimization orchestration, streaming, and persistence.
 *
 * @since 0.1.0
 */
export * as Study from "./Study/index.js"

/**
 * Lifecycle event types for progress monitoring.
 *
 * @since 0.1.0
 */
export * as StudyEvent from "./StudyEvent/index.js"

/**
 * Trial data types and state machine.
 *
 * @since 0.1.0
 */
export * as Trial from "./Trial/index.js"
