/**
 * Approximates one-dimensional roots and scalar minima with bisection and
 * golden-section search.
 *
 * @remarks
 * These operations return the latest midpoint when their iteration budget is
 * exhausted. Validated variants check option shapes and numeric bounds but do
 * not prove a sign-changing bracket or objective unimodality; callers retain
 * those mathematical preconditions.
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
