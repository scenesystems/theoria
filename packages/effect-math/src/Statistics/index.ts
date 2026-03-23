/**
 * Statistical estimators and summary statistics over immutable `Chunk`
 * carriers. Provides Bessel-corrected sample variance, arithmetic mean,
 * standard deviation, covariance, and a `SummaryStatistics` tagged class
 * for structured multi-field results.
 *
 * Statistics owns estimators and inference outputs. Distribution definitions
 * remain in Probability — Statistics imports, never redeclares, distribution
 * or measure-space contracts.
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
