/**
 * Estimates derivatives, gradients, Jacobians, Hessians, and numerical
 * integrals from caller-supplied functions or samples.
 *
 * @remarks
 * Limit estimators expose convergence metadata; scalar convenience operations
 * project only the selected value. Validated variants decode unknown boundary
 * input, and policy-aware variants read runtime precision and diagnostics
 * services.
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
