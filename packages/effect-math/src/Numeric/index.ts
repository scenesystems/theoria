/**
 * Computes stable scalar transforms, log-space arithmetic, guarded division,
 * reductions, and finite-boundary validation.
 *
 * @remarks
 * Pure kernels retain their documented IEEE 754 behavior. Validated variants
 * decode unknown input into finite schemas; policy-aware variants select
 * strict or relaxed kernels and report diagnostics through Effect services.
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
