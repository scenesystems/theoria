/**
 * Evaluates gamma, beta, incomplete gamma and beta, error, digamma, and
 * polygamma functions.
 *
 * @remarks
 * Pure kernels expose their documented approximation and pole behavior.
 * Validated variants decode unknown input against each function's domain;
 * policy-aware variants can reject non-finite results under strict precision
 * and emit diagnostics through the Effect context.
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
