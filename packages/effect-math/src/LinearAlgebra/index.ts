/**
 * Computes dense vector, matrix, decomposition, and linear-solve operations.
 *
 * @remarks
 * Pure operations use immutable `Chunk` values and trust shape metadata.
 * Selected operations expose Schema-decoded inputs or runtime precision and
 * diagnostics policies. Matrix storage passed to operations is row-major.
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
