/**
 * Complex number arithmetic, trigonometry, polar conversion, and
 * complex-step differentiation.
 *
 * Provides three tiers for every operation: a pure kernel operating
 * on `Complex` values, a Schema-validated boundary variant accepting
 * `unknown` input, and a policy-aware variant reading
 * `PrecisionPolicyService` and `DiagnosticsPolicyService` from context.
 *
 * @since 0.1.0
 * @module effect-math/Complex
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
