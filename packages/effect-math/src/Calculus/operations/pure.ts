/**
 * Runs numerical calculus operations on trusted synchronous functions and samples.
 *
 * @remarks
 * These operations do not create typed failure channels. Callback exceptions
 * escape synchronously, and non-finite calculations remain in the result.
 *
 * @since 0.1.0
 * @category operations
 */
import { Effect } from "effect"
import type { Chunk } from "effect"

import * as AdaptiveSimpsonKernel from "../internal/adaptive-simpson.js"
import * as IntegrationKernel from "../internal/integration.js"
import * as MultivariateKernel from "../internal/multivariate.js"
import * as RidderKernel from "../internal/ridder.js"
import { CalculusDomainModel } from "../model.js"
import type { DerivativeLimitEstimate, RidderMethodInputType } from "../schema.js"

/**
 * Returns the provisional Calculus descriptor without service requirements or failure.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadCalculusDomain = Effect.succeed(CalculusDomainModel)

/**
 * Estimates a first derivative by central differences and Ridder extrapolation.
 *
 * @returns The estimate with its absolute-error estimate, refinement count,
 * and tolerance status. Exhausting the configured limits returns the best
 * candidate with `converged: false`.
 *
 * @example
 * ```ts
 * import { Calculus, Numeric } from "@scenesystems/effect-math"
 * import { Effect } from "effect"
 *
 * export const program = Effect.sync(() =>
 *   Calculus.derivativeLimit((x) => Numeric.pow(x, 2), 2)
 * ).pipe(
 *   Effect.filterOrFail(
 *     (estimate) => estimate.converged && Numeric.between(estimate.value, { minimum: 3.999, maximum: 4.001 }),
 *     () => "DerivativeDidNotConverge"
 *   )
 * )
 * ```
 *
 * @since 0.2.0
 * @category operations
 */
export const derivativeLimit = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): DerivativeLimitEstimate => RidderKernel.derivativeLimitRidder(f, x, config)

/**
 * Estimates a second derivative by symmetric differences and Ridder extrapolation.
 *
 * @returns The estimate with its absolute-error estimate, refinement count,
 * and tolerance status. Exhausting the configured limits returns the best
 * candidate with `converged: false`.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeLimit = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): DerivativeLimitEstimate => RidderKernel.secondDerivativeLimitRidder(f, x, config)

/**
 * Returns the selected first-derivative value and discards convergence metadata.
 *
 * @since 0.1.0
 * @category operations
 */
export const derivative = (f: (x: number) => number, x: number, config?: RidderMethodInputType): number =>
  derivativeLimit(f, x, config).value

/**
 * Returns the selected second-derivative value and discards convergence metadata.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivative = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): number => secondDerivativeLimit(f, x, config).value

/**
 * Integrates evenly spaced samples with the composite trapezoidal rule.
 *
 * @returns `NaN` for fewer than two samples. A negative `dx` reverses the sign.
 *
 * @since 0.1.0
 * @category operations
 */
export const trapezoid = IntegrationKernel.trapezoidalRule

/**
 * Integrates evenly spaced samples with composite Simpson quadrature.
 *
 * @remarks
 * Two samples use the trapezoidal rule. With an odd number of intervals,
 * Simpson's rule covers the largest even prefix and a final trapezoid covers
 * the remaining interval. Fewer than two samples return `NaN`.
 *
 * @since 0.1.0
 * @category operations
 */
export const simpson = IntegrationKernel.simpsonsRule

/**
 * Integrates a synchronous scalar function with adaptive Simpson quadrature.
 *
 * @remarks
 * Refinement stops at the local error target or depth limit. The result does
 * not report which condition stopped recursion. Defaults are `1e-10` for both
 * tolerances and `16` levels. Reversed bounds produce a signed integral.
 *
 * @since 0.2.0
 * @category operations
 */
export const adaptiveSimpson = (
  f: (x: number) => number,
  a: number,
  b: number,
  absoluteTolerance?: number,
  relativeTolerance?: number,
  maxDepth?: number
): number =>
  AdaptiveSimpsonKernel.adaptiveSimpsonIntegral(
    f,
    a,
    b,
    absoluteTolerance,
    relativeTolerance,
    maxDepth
  )

/**
 * Estimates one partial derivative per input coordinate with Ridder extrapolation.
 *
 * @returns A newly allocated `Chunk` in input-coordinate order.
 *
 * @since 0.2.0
 * @category operations
 */
export const gradient = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<number> => MultivariateKernel.gradientLimit(f, point, config)

/**
 * Estimates a Jacobian with rows in output-component order and columns in input-coordinate order.
 *
 * @remarks
 * The row count comes from the field's baseline output. Field evaluations are
 * memoized for the duration of this call.
 *
 * @since 0.2.0
 * @category operations
 */
export const jacobian = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => MultivariateKernel.jacobianLimit(f, point, config)

/**
 * Estimates a square Hessian in input-coordinate order.
 *
 * @remarks
 * Mixed partials are computed once per coordinate pair and reused for the
 * symmetric entry. The returned rows are newly allocated.
 *
 * @since 0.2.0
 * @category operations
 */
export const hessian = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => MultivariateKernel.hessianLimit(f, point, config)

/**
 * Projects the estimated gradient onto the normalized direction vector.
 *
 * @returns `NaN` when the vectors have different lengths or the direction has
 * zero Euclidean norm. Positive scaling of `direction` leaves the result unchanged.
 *
 * @since 0.2.0
 * @category operations
 */
export const directionalDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  direction: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.directionalDerivativeLimit(f, point, direction, config)

/**
 * Sums the diagonal of a numerically estimated vector-field Jacobian.
 *
 * @returns `NaN` unless the field's output dimension equals the point dimension.
 *
 * @since 0.2.0
 * @category operations
 */
export const divergence = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.divergenceLimit(f, point, config)

/**
 * Sums the diagonal of a numerically estimated Hessian.
 *
 * @since 0.2.0
 * @category operations
 */
export const laplacian = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.laplacianLimit(f, point, config)
