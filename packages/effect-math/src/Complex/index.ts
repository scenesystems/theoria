/**
 * Complex number arithmetic, trigonometry, polar conversion, and
 * complex-step differentiation.
 *
 * @remarks
 * Pure operations accept `Complex` values. Selected calculations also expose
 * Schema-validated entry points for unknown input or policy-aware variants
 * that read precision and diagnostics services from context.
 *
 * @since 0.1.0
 * @module @scenesystems/effect-math/Complex
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
