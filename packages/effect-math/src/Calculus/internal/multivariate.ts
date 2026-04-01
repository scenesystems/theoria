/**
 * Multivariate differential operators built from Ridder limit extrapolation.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, HashMap, Number as N, Option } from "effect"

import type { RidderMethodInputType } from "../schema.js"
import { memoizeVectorField, mixedPartialKey } from "./multivariate/cache.js"
import { ridderExtrapolation } from "./ridder.js"

const getOr = (values: Chunk.Chunk<number>, index: number, fallback: number): number =>
  Option.getOrElse(Chunk.get(values, index), () => fallback)

const perturbAxis = (
  point: Chunk.Chunk<number>,
  axis: number,
  delta: number
): Chunk.Chunk<number> =>
  Chunk.makeBy(Chunk.size(point), (index) => {
    const value = Chunk.unsafeGet(point, index)
    return N.Equivalence(index, axis) ? N.sum(value, delta) : value
  })

const perturbAxes = (
  point: Chunk.Chunk<number>,
  axisA: number,
  axisB: number,
  deltaA: number,
  deltaB: number
): Chunk.Chunk<number> =>
  Chunk.makeBy(Chunk.size(point), (index) => {
    const value = Chunk.unsafeGet(point, index)

    if (N.Equivalence(index, axisA) && N.Equivalence(index, axisB)) {
      return N.sum(value, N.sum(deltaA, deltaB))
    }

    if (N.Equivalence(index, axisA)) {
      return N.sum(value, deltaA)
    }

    return N.Equivalence(index, axisB) ? N.sum(value, deltaB) : value
  })

const partialDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  axis: number,
  config?: RidderMethodInputType
): number =>
  ridderExtrapolation((step) => {
    const plus = f(perturbAxis(point, axis, step))
    const minus = f(perturbAxis(point, axis, N.negate(step)))
    return N.unsafeDivide(N.subtract(plus, minus), N.multiply(2, step))
  }, config).value

const secondPartialDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  axis: number,
  config?: RidderMethodInputType
): number => {
  const center = f(point)

  return ridderExtrapolation((step) => {
    const plus = f(perturbAxis(point, axis, step))
    const minus = f(perturbAxis(point, axis, N.negate(step)))

    return N.unsafeDivide(
      N.sum(N.subtract(plus, N.multiply(2, center)), minus),
      N.multiply(step, step)
    )
  }, config).value
}

const mixedSecondPartialDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  axisA: number,
  axisB: number,
  config?: RidderMethodInputType
): number =>
  ridderExtrapolation((step) => {
    const plusPlus = f(perturbAxes(point, axisA, axisB, step, step))
    const plusMinus = f(perturbAxes(point, axisA, axisB, step, N.negate(step)))
    const minusPlus = f(perturbAxes(point, axisA, axisB, N.negate(step), step))
    const minusMinus = f(perturbAxes(point, axisA, axisB, N.negate(step), N.negate(step)))

    return N.unsafeDivide(
      N.subtract(N.subtract(plusPlus, plusMinus), N.subtract(minusPlus, minusMinus)),
      N.multiply(4, N.multiply(step, step))
    )
  }, config).value

/**
 * Gradient via per-axis limit derivatives.
 *
 * @since 0.1.0
 * @category internal
 */
export const gradientLimit = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<number> => Chunk.makeBy(Chunk.size(point), (axis) => partialDerivative(f, point, axis, config))

/**
 * Jacobian via per-component, per-axis limit derivatives.
 *
 * @since 0.1.0
 * @category internal
 */
export const jacobianLimit = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => {
  const evaluate = memoizeVectorField(f)
  const baseline = evaluate(point)
  const outputDimensions = Chunk.size(baseline)
  const inputDimensions = Chunk.size(point)

  return Chunk.makeBy(outputDimensions, (row) =>
    Chunk.makeBy(inputDimensions, (column) =>
      partialDerivative(
        (candidate) => getOr(evaluate(candidate), row, Number.NaN),
        point,
        column,
        config
      )))
}

/**
 * Hessian via diagonal and mixed second partial limit derivatives.
 *
 * @since 0.1.0
 * @category internal
 */
export const hessianLimit = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => {
  const dimensions = Chunk.size(point)
  const state = { cache: HashMap.empty<string, number>() }

  const resolveMixedPartial = (axisA: number, axisB: number): number => {
    const key = mixedPartialKey(axisA, axisB)

    return Option.getOrElse(HashMap.get(state.cache, key), () => {
      const mixed = mixedSecondPartialDerivative(f, point, axisA, axisB, config)
      state.cache = HashMap.set(state.cache, key, mixed)
      return mixed
    })
  }

  return Chunk.makeBy(dimensions, (row) =>
    Chunk.makeBy(dimensions, (column) =>
      N.Equivalence(row, column)
        ? secondPartialDerivative(f, point, row, config)
        : resolveMixedPartial(row, column)))
}

/**
 * Directional derivative as gradient projection on normalized direction.
 *
 * @since 0.1.0
 * @category internal
 */
export const directionalDerivativeLimit = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  direction: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => {
  const dimensionsMatch = N.Equivalence(Chunk.size(point), Chunk.size(direction))
  if (dimensionsMatch === false) {
    return Number.NaN
  }

  const directionNorm = Math.sqrt(
    Chunk.reduce(direction, 0, (acc, value) => N.sum(acc, N.multiply(value, value)))
  )

  if (N.lessThanOrEqualTo(directionNorm, 0)) {
    return Number.NaN
  }

  const gradient = gradientLimit(f, point, config)
  const numerator = Chunk.reduce(
    gradient,
    0,
    (acc, value, index) => N.sum(acc, N.multiply(value, getOr(direction, index, 0)))
  )

  return N.unsafeDivide(numerator, directionNorm)
}

/**
 * Divergence as trace of Jacobian for vector fields with matching dimensions.
 *
 * @since 0.1.0
 * @category internal
 */
export const divergenceLimit = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => {
  const jacobian = jacobianLimit(f, point, config)
  const inputDimensions = Chunk.size(point)

  if (N.Equivalence(Chunk.size(jacobian), inputDimensions) === false) {
    return Number.NaN
  }

  return Chunk.reduce(jacobian, 0, (acc, row, index) => N.sum(acc, getOr(row, index, Number.NaN)))
}

/**
 * Laplacian as trace of Hessian.
 *
 * @since 0.1.0
 * @category internal
 */
export const laplacianLimit = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
): number => {
  const hessian = hessianLimit(f, point, config)

  return Chunk.reduce(hessian, 0, (acc, row, index) => N.sum(acc, getOr(row, index, Number.NaN)))
}
