/**
 * Computes sample estimators and summary statistics over immutable numeric
 * collections.
 *
 * @remarks
 * Variance and covariance use Bessel's correction. Distribution definitions
 * and probability measures remain in the probability domains; this module
 * owns estimators and their structured outputs.
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
