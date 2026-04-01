/**
 * Pure calculus kernels.
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
 * Lifts the static `CalculusDomainModel` into an Effect for runtime discovery.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadCalculusDomain = Effect.succeed(CalculusDomainModel)

/**
 * Ridder-method first-derivative estimate with convergence metadata.
 *
 * @since 0.1.0
 * @category operations
 */
export const derivativeLimit = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): DerivativeLimitEstimate => RidderKernel.derivativeLimitRidder(f, x, config)

/**
 * Ridder-method second-derivative estimate with convergence metadata.
 *
 * @since 0.1.0
 * @category operations
 */
export const secondDerivativeLimit = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): DerivativeLimitEstimate => RidderKernel.secondDerivativeLimitRidder(f, x, config)

/**
 * First derivative value projected from `derivativeLimit`.
 *
 * @since 0.1.0
 * @category operations
 */
export const derivative = (f: (x: number) => number, x: number, config?: RidderMethodInputType): number =>
  derivativeLimit(f, x, config).value

/**
 * Second derivative value projected from `secondDerivativeLimit`.
 *
 * @since 0.1.0
 * @category operations
 */
export const secondDerivative = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): number => secondDerivativeLimit(f, x, config).value

/**
 * Composite trapezoidal integration over evenly-spaced samples.
 *
 * @since 0.1.0
 * @category operations
 */
export const trapezoid = IntegrationKernel.trapezoidalRule

/**
 * Composite Simpson integration over evenly-spaced samples.
 *
 * @since 0.1.0
 * @category operations
 */
export const simpson = IntegrationKernel.simpsonsRule

/**
 * Adaptive Simpson integration with configurable tolerance and recursion bounds.
 *
 * @since 0.1.0
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
 * Multivariate gradient evaluated via Ridder-limit directional probes.
 *
 * @since 0.1.0
 * @category operations
 */
export const gradient = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<number> => MultivariateKernel.gradientLimit(f, point, config)

/**
 * Multivariate Jacobian evaluated via Ridder-limit directional probes.
 *
 * @since 0.1.0
 * @category operations
 */
export const jacobian = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => MultivariateKernel.jacobianLimit(f, point, config)

/**
 * Multivariate Hessian evaluated via Ridder-limit directional probes.
 *
 * @since 0.1.0
 * @category operations
 */
export const hessian = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => MultivariateKernel.hessianLimit(f, point, config)

/**
 * Directional derivative along a supplied direction vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const directionalDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  direction: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.directionalDerivativeLimit(f, point, direction, config)

/**
 * Vector-field divergence from component-wise directional derivatives.
 *
 * @since 0.1.0
 * @category operations
 */
export const divergence = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.divergenceLimit(f, point, config)

/**
 * Scalar-field Laplacian from summed second partial derivatives.
 *
 * @since 0.1.0
 * @category operations
 */
export const laplacian = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.laplacianLimit(f, point, config)
