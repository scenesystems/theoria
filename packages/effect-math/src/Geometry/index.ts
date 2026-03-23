/**
 * Metric-space geometry over immutable `Chunk` carriers — Euclidean,
 * Manhattan, and Chebyshev distances, midpoint computation, and centroid
 * of point sets. Provides three tiers: pure kernel functions, Effect-wrapped
 * operations with Schema-validated boundary input, and policy-aware variants
 * that respect precision and diagnostics runtime services.
 *
 * Geometry is a first-wave stable domain — its API surface is fixed and
 * breaking changes follow semver.
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
