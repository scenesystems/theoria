/**
 * Multivariate differential operators built from Ridder limit extrapolation.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, HashMap, Number, Option, Tuple } from "effect"

import * as Numeric from "../../Numeric/index.js"
import type { RidderMethodInputType } from "../schema.js"
import { evaluateVectorField, type MixedPartialKey, mixedPartialKey, VectorFieldCache } from "./multivariate/cache.js"
import { ridderExtrapolation, ridderExtrapolationWithState, StatefulStepResult } from "./ridder/core.js"

const NOT_A_NUMBER = Number.unsafeDivide(0, 0)

const getOr = (values: Chunk.Chunk<number>, index: number, fallback: number): number =>
  Option.getOrElse(Chunk.get(values, index), () => fallback)

const perturbAxis = (
  point: Chunk.Chunk<number>,
  axis: number,
  delta: number
): Chunk.Chunk<number> =>
  Chunk.map(point, (value, index) =>
    Boolean.match(Number.Equivalence(index, axis), {
      onTrue: () => Number.sum(value, delta),
      onFalse: () => value
    }))

const perturbAxes = (
  point: Chunk.Chunk<number>,
  axisA: number,
  axisB: number,
  deltaA: number,
  deltaB: number
): Chunk.Chunk<number> =>
  Chunk.map(point, (value, index) => {
    const onAxisA = Number.Equivalence(index, axisA)
    const onAxisB = Number.Equivalence(index, axisB)
    return Boolean.match(Boolean.and(onAxisA, onAxisB), {
      onTrue: () => Number.sum(value, Number.sum(deltaA, deltaB)),
      onFalse: () =>
        Boolean.match(onAxisA, {
          onTrue: () => Number.sum(value, deltaA),
          onFalse: () =>
            Boolean.match(onAxisB, {
              onTrue: () => Number.sum(value, deltaB),
              onFalse: () => value
            })
        })
    })
  })

const partialDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  axis: number,
  config?: RidderMethodInputType
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
  config?: RidderMethodInputType
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
  config?: RidderMethodInputType
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
  config?: RidderMethodInputType
): Chunk.Chunk<number> => Chunk.map(point, (_coordinate, axis) => partialDerivative(f, point, axis, config))

const cachedPartialDerivative = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  row: number,
  column: number,
  cache: VectorFieldCache,
  config?: RidderMethodInputType
) =>
  ridderExtrapolationWithState(
    (step, currentCache) => {
      const plus = evaluateVectorField(f, currentCache, perturbAxis(point, column, step))
      const minus = evaluateVectorField(f, plus.cache, perturbAxis(point, column, Number.negate(step)))
      return new StatefulStepResult({
        value: Number.unsafeDivide(
          Number.subtract(
            getOr(plus.value, row, NOT_A_NUMBER),
            getOr(minus.value, row, NOT_A_NUMBER)
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
  config?: RidderMethodInputType
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

const resolveHessianEntry = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  row: number,
  column: number,
  cache: HashMap.HashMap<MixedPartialKey, number>,
  config?: RidderMethodInputType
) => {
  const key = mixedPartialKey(row, column)
  return Boolean.match(Number.Equivalence(row, column), {
    onTrue: () => {
      const value = secondPartialDerivative(f, point, row, config)
      return Tuple.make(HashMap.set(cache, key, value), value)
    },
    onFalse: () =>
      Option.match(HashMap.get(cache, key), {
        onSome: (value) => Tuple.make(cache, value),
        onNone: () => {
          const value = mixedSecondPartialDerivative(f, point, row, column, config)
          return Tuple.make(HashMap.set(cache, key, value), value)
        }
      })
  })
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
  config?: RidderMethodInputType
): Chunk.Chunk<Chunk.Chunk<number>> => {
  const axes = Chunk.map(point, (_coordinate, axis) => axis)
  const [_cache, values] = Chunk.mapAccum(
    axes,
    HashMap.empty<MixedPartialKey, number>(),
    (cache, row) => {
      const [nextCache, rowValues] = Chunk.mapAccum(
        axes,
        cache,
        (currentCache, column) => resolveHessianEntry(f, point, row, column, currentCache, config)
      )
      return Tuple.make(nextCache, rowValues)
    }
  )

  return values
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
): number =>
  Boolean.match(Number.Equivalence(Chunk.size(point), Chunk.size(direction)), {
    onFalse: () => NOT_A_NUMBER,
    onTrue: () => {
      const directionNorm = Numeric.sqrt(
        Chunk.reduce(direction, 0, (acc, value) => Number.sum(acc, Number.multiply(value, value)))
      )
      return Boolean.match(Number.lessThanOrEqualTo(directionNorm, 0), {
        onTrue: () => NOT_A_NUMBER,
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
  config?: RidderMethodInputType
): number => {
  const jacobian = jacobianLimit(f, point, config)
  return Boolean.match(Number.Equivalence(Chunk.size(jacobian), Chunk.size(point)), {
    onFalse: () => NOT_A_NUMBER,
    onTrue: () => Chunk.reduce(jacobian, 0, (acc, row, index) => Number.sum(acc, getOr(row, index, NOT_A_NUMBER)))
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
  config?: RidderMethodInputType
): number =>
  Chunk.reduce(
    hessianLimit(f, point, config),
    0,
    (acc, row, index) => Number.sum(acc, getOr(row, index, NOT_A_NUMBER))
  )
