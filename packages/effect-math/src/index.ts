/**
 * Composes numerical domains with shared validation and runtime-policy
 * contracts for Effect programs.
 *
 * @remarks
 * Domain namespaces separate pure kernels, Schema-validated boundaries, and
 * policy-aware operations. Cross-domain contracts are also available from the
 * `contracts` subpath.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Scalar numeric operations and validated numeric boundaries.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Numeric from "./Numeric/index.js"

/**
 * Integer, factorial, and polynomial operations.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Algebra from "./Algebra/index.js"

/**
 * Dense vector and matrix operations.
 *
 * @since 0.1.0
 * @category domains
 */
export * as LinearAlgebra from "./LinearAlgebra/index.js"

/**
 * Numerical differentiation and integration operations.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Calculus from "./Calculus/index.js"

/**
 * Special functions and their validated boundaries.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Special from "./Special/index.js"

/**
 * Probability functions and distribution contracts.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Probability from "./Probability/index.js"

/**
 * Descriptive statistics and estimators.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Statistics from "./Statistics/index.js"

/**
 * Root-finding and scalar minimization operations.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Optimization from "./Optimization/index.js"

/**
 * Metric and point-set geometry operations.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Geometry from "./Geometry/index.js"

/**
 * Complex-number schemas and arithmetic.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Complex from "./Complex/index.js"

/**
 * Probability-distribution models and operations.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Distribution from "./Distribution/index.js"

/**
 * Cross-domain schemas, errors, policy services, and provider Layers.
 *
 * The same exports are available from `@scenesystems/effect-math/contracts`.
 *
 * @since 0.1.0
 * @category contracts
 */
export * from "./contracts/index.js"
