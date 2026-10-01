/**
 * Mathematical operations, validated representations, and computation policies.
 * Each namespace is also available through its matching package subpath.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Scalar arithmetic, transcendentals, reductions, and numerical settings.
 * @since 0.1.0
 * @category modules
 */
export * as Numeric from "./Numeric.js"

/**
 * Polynomial and integer operations.
 * @since 0.1.0
 * @category modules
 */
export * as Algebra from "./Algebra.js"

/**
 * Dense vector and matrix operations.
 * @since 0.1.0
 * @category modules
 */
export * as LinearAlgebra from "./LinearAlgebra.js"

/**
 * Real and complex-step differentiation and numerical integration.
 * @since 0.1.0
 * @category modules
 */
export * as Calculus from "./Calculus.js"

/**
 * Special functions and inverse functions.
 * @since 0.1.0
 * @category modules
 */
export * as Special from "./Special.js"

/**
 * Probability masses and discrete Shannon entropy.
 * @since 0.1.0
 * @category modules
 */
export * as Probability from "./Probability.js"

/**
 * Distribution parameters, densities, cumulative probabilities, and quantiles.
 * @since 0.1.0
 * @category modules
 */
export * as Distribution from "./Distribution.js"

/**
 * Descriptive statistics and estimators.
 * @since 0.1.0
 * @category modules
 */
export * as Statistics from "./Statistics.js"

/**
 * Root finding and scalar minimization.
 * @since 0.1.0
 * @category modules
 */
export * as Optimization from "./Optimization.js"

/**
 * Metrics and point-set geometry.
 * @since 0.1.0
 * @category modules
 */
export * as Geometry from "./Geometry.js"

/**
 * Complex values, arithmetic, polar conversion, and vector operations.
 * @since 0.1.0
 * @category modules
 */
export * as Complex from "./Complex.js"

/**
 * Runtime precision, diagnostics, backend preference, and randomness settings.
 * @since 0.1.0
 * @category modules
 */
export * as Policy from "./Policy.js"

/**
 * Scalar representation selection from declared capabilities.
 * @since 0.1.0
 * @category modules
 */
export * as Scalar from "./Scalar.js"

/**
 * Backend selection for a scalar representation.
 * @since 0.1.0
 * @category modules
 */
export * as Backend from "./Backend.js"

/**
 * Convergence gates and precision escalation decisions.
 * @since 0.1.0
 * @category modules
 */
export * as Precision from "./Precision.js"

/**
 * Differentiation-mode selection and finite-difference fallback planning.
 * @since 0.1.0
 * @category modules
 */
export * as Autodiff from "./Autodiff.js"

/**
 * Floating-point and decimal uncertainty intervals and bounds.
 * @since 0.1.0
 * @category modules
 */
export * as Uncertainty from "./Uncertainty.js"

/**
 * Combined scalar, precision, backend, and differentiation planning.
 * @since 0.1.0
 * @category modules
 */
export * as Computation from "./Computation.js"
