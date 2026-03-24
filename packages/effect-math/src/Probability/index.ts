/**
 * Probability distribution evaluation and information-theoretic measures.
 * Provides normal (Gaussian) and uniform PDF/CDF kernels, and Shannon
 * entropy over discrete distributions. All kernels operate on scalar
 * arguments or `Chunk<number>` carriers using Effect primitives.
 *
 * Probability owns distribution contracts and measure-space primitives —
 * Statistics consumes these for estimation and inference but must not
 * redeclare them.
 *
 * @since 0.1.0
 * @module
 */

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./contract.js"

/**
 * @since 0.1.0
 * @category models
 */
export * from "./model.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schema.js"

/**
 * @since 0.1.0
 * @category errors
 */
export * from "./errors.js"

/**
 * @since 0.1.0
 * @category operations
 */
export * from "./operations.js"
