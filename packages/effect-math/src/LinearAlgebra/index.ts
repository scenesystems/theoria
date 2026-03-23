/**
 * Dense linear algebra over immutable `Chunk` carriers — dot products,
 * norms (L1/L2/L∞), matrix-vector multiplication, transposition, and
 * Frobenius norm. Provides three tiers: pure kernel functions, Effect-wrapped
 * operations with Schema-validated boundary input, and policy-aware variants
 * that respect precision, backend, and diagnostics runtime services.
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
