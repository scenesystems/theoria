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

export const derivativeLimit = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): DerivativeLimitEstimate => RidderKernel.derivativeLimitRidder(f, x, config)

export const secondDerivativeLimit = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): DerivativeLimitEstimate => RidderKernel.secondDerivativeLimitRidder(f, x, config)

export const derivative = (f: (x: number) => number, x: number, config?: RidderMethodInputType): number =>
  derivativeLimit(f, x, config).value

export const secondDerivative = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): number => secondDerivativeLimit(f, x, config).value

export const trapezoid = IntegrationKernel.trapezoidalRule

export const simpson = IntegrationKernel.simpsonsRule

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

export const gradient = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<number> => MultivariateKernel.gradientLimit(f, point, config)

export const jacobian = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => MultivariateKernel.jacobianLimit(f, point, config)

export const hessian = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => MultivariateKernel.hessianLimit(f, point, config)

export const directionalDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  direction: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.directionalDerivativeLimit(f, point, direction, config)

export const divergence = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.divergenceLimit(f, point, config)

export const laplacian = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => MultivariateKernel.laplacianLimit(f, point, config)
