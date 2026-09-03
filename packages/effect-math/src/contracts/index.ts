/**
 * Defines runtime policy and computation-planning contracts shared by Effect Math domains.
 *
 * @remarks
 * Use domain entry points for numerical operations. This subpath contains
 * shared Schemas, typed failures, Context services, and resource-free Layers.
 * Its advanced-dispatch APIs produce plans and do not execute numerical
 * kernels.
 *
 * @since 0.1.0
 * @module
 */

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/BrandedScalars.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/DomainStability.js"

/**
 * @since 0.1.0
 * @category errors
 */
export * from "./shared/BoundaryErrors.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/RuntimePolicies.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/DomainOwnership.js"

/**
 * @since 0.1.0
 * @category combinators
 */
export * from "./shared/PolicyGuards.js"

/**
 * @since 0.1.0
 * @category errors
 */
export * from "./shared/AdvancedComputationErrors.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/ScalarAuthority.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/PrecisionEscalation.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/BackendAuthority.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/AutodiffAuthority.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/UncertaintyEnvelope.js"

/**
 * @since 0.1.0
 * @category contracts
 */
export * from "./shared/ComputationDispatch.js"
