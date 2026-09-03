/**
 * Evaluates normal and uniform distributions and discrete Shannon entropy.
 *
 * @remarks
 * Pure kernels accept decoded scalars or immutable probability collections.
 * Validated variants decode unknown boundary input, and policy-aware variants
 * read precision and diagnostics services from context.
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
