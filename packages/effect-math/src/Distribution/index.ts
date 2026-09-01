/**
 * Models and evaluates discrete and continuous statistical distributions.
 *
 * @remarks
 * Normal, LogNormal, Exponential, Uniform, Beta, Gamma, StudentT,
 * Categorical, Binomial, and Poisson families expose PDF, CDF, log-PDF,
 * quantile, and summary-statistic operations. This domain owns their parameter
 * and evaluation schemas; downstream domains consume those contracts rather
 * than redeclaring them.
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
