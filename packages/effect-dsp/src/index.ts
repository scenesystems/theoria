/**
 * Defines schema-first language-model programs that can be evaluated and
 * optimized inside Effect workflows.
 *
 * @remarks
 * Define input and output contracts with `Signature`, construct executable
 * programs with `Module`, score them against `Example` values through
 * `Metric` and `Evaluate`, and use `Optimizer` when their parameters should be
 * learned. `Cache` and `Trace` supply runtime integrations for those
 * executions.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Schema-backed input and output contracts for model programs.
 *
 * @since 0.1.0
 * @category signatures
 */
export * as Signature from "./Signature/index.js"

/**
 * Executable model programs and their learnable parameters.
 *
 * @since 0.1.0
 * @category modules
 */
export * as Module from "./Module/index.js"

/**
 * Optimizers that derive program parameters from examples and metrics.
 *
 * @since 0.1.0
 * @category optimizers
 */
export * as Optimizer from "./Optimizer/index.js"

/**
 * Scoring contracts and constructors used by evaluation and optimization.
 *
 * @since 0.1.0
 * @category metrics
 */
export * as Metric from "./Metric/index.js"

/**
 * Batch and streaming evaluation of programs against labeled examples.
 *
 * @since 0.1.0
 * @category evaluation
 */
export * as Evaluate from "./Evaluate/index.js"

/**
 * Labeled examples and demonstrations for evaluation and optimization.
 *
 * @since 0.1.0
 * @category models
 */
export * as Example from "./Example/index.js"

/**
 * Fiber-scoped execution traces and token-usage accounting.
 *
 * @since 0.1.0
 * @category tracing
 */
export * as Trace from "./Trace/index.js"

/**
 * Package-owned typed failures.
 *
 * @since 0.1.0
 * @category errors
 */
export * as Errors from "./Errors/index.js"

/**
 * Shared language-model call caching and rollout partitioning.
 *
 * @since 0.1.0
 * @category cache
 */
export * as Cache from "./Cache/index.js"
