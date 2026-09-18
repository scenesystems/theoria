/**
 * Multivariate differential operators built from Ridder limit extrapolation.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, HashMap, Number, Option, Tuple } from "effect"

import type { RidderMethodInput } from "../../Calculus.js"
import * as Numeric from "../../Numeric.js"
import { evaluateVectorField, VectorFieldCache } from "./multivariateCache.js"
import { ridderExtrapolation, ridderExtrapolationWithState, StatefulStepResult } from "./ridderCore.js"

const notANumber = Number.unsafeDivide(0, 0)

const getOr = (values: Chunk.Chunk<number>, index: number, fallback: number): number =>
  Option.getOrElse(Chunk.get(values, index), () => fallback)

const perturbAxis = (
  point: Chunk.Chunk<number>,
  axis: number,
  delta: number
): Chunk.Chunk<number> => Chunk.modify(point, axis, (value) => Number.sum(value, delta))

const perturbAxes = (
  point: Chunk.Chunk<number>,
  axisA: number,
  axisB: number,
  deltaA: number,
  deltaB: number
): Chunk.Chunk<number> =>
  Boolean.match(Number.Equivalence(axisA, axisB), {
    onTrue: () => Chunk.modify(point, axisA, (value) => Number.sum(value, Number.sum(deltaA, deltaB))),
    onFalse: () =>
      Chunk.modify(
        Chunk.modify(point, axisA, (value) => Number.sum(value, deltaA)),
        axisB,
        (value) => Number.sum(value, deltaB)
      )
  })

const partialDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  axis: number,
  config?: RidderMethodInput
): number =>
  ridderExtrapolation((step) => {
    const plus = f(perturbAxis(point, axis, step))
    const minus = f(perturbAxis(point, axis, Number.negate(step)))
    return Number.unsafeDivide(Number.subtract(plus, minus), Number.multiply(2, step))
  }, config).value

const secondPartialDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  axis: number,
  config?: RidderMethodInput
): number => {
  const center = f(point)
  return ridderExtrapolation((step) => {
    const plus = f(perturbAxis(point, axis, step))
    const minus = f(perturbAxis(point, axis, Number.negate(step)))
    return Number.unsafeDivide(
      Number.sum(Number.subtract(plus, Number.multiply(2, center)), minus),
      Number.multiply(step, step)
    )
  }, config).value
}

const mixedSecondPartialDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  axisA: number,
  axisB: number,
  config?: RidderMethodInput
): number =>
  ridderExtrapolation((step) => {
    const plusPlus = f(perturbAxes(point, axisA, axisB, step, step))
    const plusMinus = f(perturbAxes(point, axisA, axisB, step, Number.negate(step)))
    const minusPlus = f(perturbAxes(point, axisA, axisB, Number.negate(step), step))
    const minusMinus = f(perturbAxes(point, axisA, axisB, Number.negate(step), Number.negate(step)))
    return Number.unsafeDivide(
      Number.subtract(Number.subtract(plusPlus, plusMinus), Number.subtract(minusPlus, minusMinus)),
      Number.multiply(4, Number.multiply(step, step))
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
  config?: RidderMethodInput
): Chunk.Chunk<number> => Chunk.map(point, (_coordinate, axis) => partialDerivative(f, point, axis, config))

const cachedPartialDerivative = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  row: number,
  column: number,
  cache: VectorFieldCache,
  config?: RidderMethodInput
) =>
  ridderExtrapolationWithState(
    (step, currentCache) => {
      const plus = evaluateVectorField(f, currentCache, perturbAxis(point, column, step))
      const minus = evaluateVectorField(f, plus.cache, perturbAxis(point, column, Number.negate(step)))
      return new StatefulStepResult({
        value: Number.unsafeDivide(
          Number.subtract(
            getOr(plus.value, row, notANumber),
            getOr(minus.value, row, notANumber)
          ),
          Number.multiply(2, step)
        ),
        state: minus.cache
      })
    },
    cache,
    config
  )

/**
 * Jacobian via per-component, per-axis limit derivatives.
 *
 * @since 0.1.0
 * @category internal
 */
export const jacobianLimit = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInput
): Chunk.Chunk<Chunk.Chunk<number>> => {
  const baseline = f(point)
  const rows = Chunk.map(baseline, (_component, row) => row)
  const columns = Chunk.map(point, (_coordinate, column) => column)
  const initialCache = new VectorFieldCache({ values: HashMap.make(Tuple.make(point, baseline)) })
  const [_cache, values] = Chunk.mapAccum(rows, initialCache, (cache, row) => {
    const [nextCache, rowValues] = Chunk.mapAccum(columns, cache, (currentCache, column) => {
      const result = cachedPartialDerivative(f, point, row, column, currentCache, config)
      return Tuple.make(result.state, result.estimate.value)
    })
    return Tuple.make(nextCache, rowValues)
  })

  return values
}

/**
 * Hessian via diagonal and cached symmetric mixed partial derivatives.
 *
 * @since 0.1.0
 * @category internal
 */
export const hessianLimit = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInput
): Chunk.Chunk<Chunk.Chunk<number>> => {
  const axes = Chunk.map(point, (_coordinate, axis) => axis)
  return Chunk.reduce(
    axes,
    Chunk.empty<Chunk.Chunk<number>>(),
    (rows, row) => {
      const rowValues = Chunk.map(axes, (column) =>
        Boolean.match(Number.lessThan(column, row), {
          onTrue: () => Chunk.unsafeGet(Chunk.unsafeGet(rows, column), row),
          onFalse: () =>
            Boolean.match(Number.Equivalence(row, column), {
              onTrue: () => secondPartialDerivative(f, point, row, config),
              onFalse: () => mixedSecondPartialDerivative(f, point, row, column, config)
            })
        }))
      return Chunk.append(rows, rowValues)
    }
  )
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
  config?: RidderMethodInput
): number =>
  Boolean.match(Number.Equivalence(Chunk.size(point), Chunk.size(direction)), {
    onFalse: () => notANumber,
    onTrue: () => {
      const directionNorm = Numeric.sqrt(
        Chunk.reduce(direction, 0, (acc, value) => Number.sum(acc, Number.multiply(value, value)))
      )
      return Boolean.match(Number.lessThanOrEqualTo(directionNorm, 0), {
        onTrue: () => notANumber,
        onFalse: () => {
          const gradient = gradientLimit(f, point, config)
          const numerator = Chunk.reduce(Chunk.zipWith(gradient, direction, Number.multiply), 0, Number.sum)
          return Number.unsafeDivide(numerator, directionNorm)
        }
      })
    }
  })

/**
 * Divergence as trace of Jacobian for vector fields with matching dimensions.
 *
 * @since 0.1.0
 * @category internal
 */
export const divergenceLimit = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInput
): number => {
  const jacobian = jacobianLimit(f, point, config)
  return Boolean.match(Number.Equivalence(Chunk.size(jacobian), Chunk.size(point)), {
    onFalse: () => notANumber,
    onTrue: () => Chunk.reduce(jacobian, 0, (acc, row, index) => Number.sum(acc, getOr(row, index, notANumber)))
  })
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
  config?: RidderMethodInput
): number =>
  Chunk.reduce(
    hessianLimit(f, point, config),
    0,
    (acc, row, index) => Number.sum(acc, getOr(row, index, notANumber))
  )
