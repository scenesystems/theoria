/**
 * CMA-ES state evolution helpers.
 *
 * @since 0.1.0
 */
import { log, pow, sqrt } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Match, Number as Num, Option, Order } from "effect"

import type { Vector } from "../../../Objective.js"

import { exp } from "../../exponential.js"
import { l2Norm } from "../math.js"

/**
 * Completed observation encoded for CMA-ES generation updates.
 *
 * @since 0.1.0
 * @category models
 */
export class CmaEsObservation extends Data.Class<{
  readonly trialNumber: number
  readonly vector: Vector
  readonly value: number
}> {}

/**
 * Mutable CMA-ES search state projected as an immutable value object.
 *
 * @since 0.1.0
 * @category models
 */
export class CmaEsState extends Data.Class<{
  readonly mean: Vector
  readonly sigma: number
  readonly covarianceDiag: Vector
  readonly pSigma: Vector
  readonly pC: Vector
}> {}

/**
 * Derived adaptation constants for CMA-ES step and covariance updates.
 *
 * @since 0.1.0
 * @category models
 */
export class CmaEsConstants extends Data.Class<{
  readonly cSigma: number
  readonly dSigma: number
  readonly cC: number
  readonly c1: number
  readonly cMu: number
  readonly muEffective: number
  readonly expectedNorm: number
  readonly hSigmaThreshold: number
}> {}

const vectorValueAt = (vectorInput: Iterable<number>, index: number): number => {
  const vector = Arr.fromIterable(vectorInput)
  return Arr.get(vector, index).pipe(Option.getOrElse(() => 0.5))
}

const numericValueAt = (vectorInput: Iterable<number>, index: number, fallback = 0): number => {
  const vector = Arr.fromIterable(vectorInput)
  return Arr.get(vector, index).pipe(Option.getOrElse(() => fallback))
}

/**
 * Reads diagonal covariance values with unit fallback for missing entries.
 *
 * @since 0.1.0
 * @category operations
 */
export const covarianceValueAt = (vectorInput: Iterable<number>, index: number): number => {
  const vector = Arr.fromIterable(vectorInput)
  return Arr.get(vector, index).pipe(Option.getOrElse(() => 1))
}

const zeros = (dimension: number) => Arr.makeBy(dimension, () => 0)

/**
 * Creates the canonical CMA-ES initial state in normalized coordinates.
 *
 * @since 0.1.0
 * @category operations
 */
export const createInitialState = (
  meanInput: Iterable<number>,
  sigma: number,
  dimension: number
): CmaEsState => {
  const mean = Arr.fromIterable(meanInput)
  return new CmaEsState({
    mean,
    sigma,
    covarianceDiag: Arr.makeBy(dimension, () => 1),
    pSigma: zeros(dimension),
    pC: zeros(dimension)
  })
}

/**
 * Computes normalized recombination weights for the elite population.
 *
 * @since 0.1.0
 * @category operations
 */
export const recombinationWeights = (mu: number) => {
  const rawWeights = Arr.makeBy(mu, (index) => Num.subtract(log(Num.sum(mu, 0.5)), log(Num.increment(index))))
  const denominator = Arr.reduce(rawWeights, 0, Num.sum)
  return Arr.map(rawWeights, (weight) => Num.unsafeDivide(weight, denominator))
}

const muEffective = (weightsInput: Iterable<number>): number => {
  const weights = Arr.fromIterable(weightsInput)
  return Num.unsafeDivide(1, Arr.reduce(weights, 0, (sum, weight) => Num.sum(sum, Num.multiply(weight, weight))))
}

/**
 * Derives CMA-ES adaptation constants for a dimension and weight set.
 *
 * @since 0.1.0
 * @category operations
 */
export const cmaEsConstants = (dimensions: number, weightsInput: Iterable<number>): CmaEsConstants => {
  const weights = Arr.fromIterable(weightsInput)

  const muEff = muEffective(weights)
  const cSigma = Num.unsafeDivide(Num.sum(muEff, 2), Num.sum(Num.sum(dimensions, muEff), 5))
  const dSigma = Num.sum(
    Num.sum(
      1,
      Num.multiply(
        2,
        Num.max(
          0,
          Num.decrement(sqrt(
            Num.unsafeDivide(Num.decrement(muEff), Num.increment(dimensions))
          ))
        )
      )
    ),
    cSigma
  )
  const cC = Num.unsafeDivide(
    Num.sum(4, Num.unsafeDivide(muEff, dimensions)),
    Num.sum(Num.sum(dimensions, 4), Num.multiply(2, Num.unsafeDivide(muEff, dimensions)))
  )
  const dimensionOffset = Num.sum(dimensions, 1.3)
  const c1 = Num.unsafeDivide(2, Num.sum(Num.multiply(dimensionOffset, dimensionOffset), muEff))
  const cMuDimensionOffset = Num.sum(dimensions, 2)
  const cMuBase = Num.unsafeDivide(
    Num.multiply(2, Num.sum(Num.subtract(muEff, 2), Num.unsafeDivide(1, muEff))),
    Num.sum(Num.multiply(cMuDimensionOffset, cMuDimensionOffset), muEff)
  )

  return new CmaEsConstants({
    cSigma,
    dSigma,
    cC,
    c1,
    cMu: Num.min(Num.subtract(1, c1), cMuBase),
    muEffective: muEff,
    expectedNorm: Num.multiply(
      sqrt(dimensions),
      Num.sum(
        Num.subtract(1, Num.unsafeDivide(1, Num.multiply(4, dimensions))),
        Num.unsafeDivide(1, Num.multiply(21, Num.multiply(dimensions, dimensions)))
      )
    ),
    hSigmaThreshold: Num.sum(1.4, Num.unsafeDivide(2, Num.increment(dimensions)))
  })
}

const weightedEliteMean = (
  eliteInput: Iterable<CmaEsObservation>,
  weightsInput: Iterable<number>,
  dimension: number
) => {
  const elite = Arr.fromIterable(eliteInput)
  const weights = Arr.fromIterable(weightsInput)
  return Arr.makeBy(dimension, (index) =>
    Arr.reduce(
      Arr.makeBy(Arr.length(elite), (position) => position),
      0,
      (sum, position) => {
        const weight = Arr.get(weights, position).pipe(Option.getOrElse(() => 0))
        const vector = Arr.get(elite, position).pipe(
          Option.map((observation) => observation.vector),
          Option.getOrElse(() => Arr.empty<number>())
        )

        return Num.sum(sum, Num.multiply(weight, vectorValueAt(vector, index)))
      }
    ))
}

/**
 * Advances CMA-ES state by one completed generation.
 *
 * @since 0.1.0
 * @category operations
 */
export const updateState = (
  current: CmaEsState,
  generationInput: Iterable<CmaEsObservation>,
  generationNumber: number,
  weightsInput: Iterable<number>,
  constants: CmaEsConstants,
  mu: number,
  dimension: number
): CmaEsState => {
  const generation = Arr.fromIterable(generationInput)
  const weights = Arr.fromIterable(weightsInput)

  const elite = Arr.sort(generation, Order.mapInput(Order.number, (observation: CmaEsObservation) => observation.value))
  const selectedElite = Arr.take(elite, mu)
  const weightedMean = weightedEliteMean(selectedElite, weights, dimension)
  const y = Arr.makeBy(
    dimension,
    (index) =>
      Num.unsafeDivide(
        Num.subtract(vectorValueAt(weightedMean, index), vectorValueAt(current.mean, index)),
        current.sigma
      )
  )
  const inverseRootC = Arr.makeBy(
    dimension,
    (index) =>
      Num.unsafeDivide(
        numericValueAt(y, index),
        sqrt(Num.max(covarianceValueAt(current.covarianceDiag, index), 1e-12))
      )
  )
  const pSigma = Arr.makeBy(
    dimension,
    (index) =>
      Num.sum(
        Num.multiply(Num.subtract(1, constants.cSigma), numericValueAt(current.pSigma, index)),
        Num.multiply(
          sqrt(Num.multiply(
            Num.multiply(constants.cSigma, Num.subtract(2, constants.cSigma)),
            constants.muEffective
          )),
          numericValueAt(inverseRootC, index)
        )
      )
  )
  const normPSigma = l2Norm(pSigma)
  const sigmaScale = exp(Num.multiply(
    Num.unsafeDivide(constants.cSigma, constants.dSigma),
    Num.decrement(Num.unsafeDivide(normPSigma, constants.expectedNorm))
  ))
  const nextSigma = Num.clamp(Num.multiply(current.sigma, sigmaScale), {
    minimum: 1e-6,
    maximum: 2
  })
  const normCorrection = sqrt(Num.subtract(
    1,
    pow(Num.subtract(1, constants.cSigma), Num.multiply(2, generationNumber))
  ))
  const hSigmaMetric = Num.unsafeDivide(Num.unsafeDivide(normPSigma, normCorrection), constants.expectedNorm)
  const hSigma = Match.value(Num.lessThan(hSigmaMetric, constants.hSigmaThreshold)).pipe(
    Match.when(true, () => 1),
    Match.orElse(() => 0)
  )
  const pC = Arr.makeBy(
    dimension,
    (index) =>
      Num.sum(
        Num.multiply(Num.subtract(1, constants.cC), numericValueAt(current.pC, index)),
        Num.multiply(
          Num.multiply(
            hSigma,
            sqrt(Num.multiply(
              Num.multiply(constants.cC, Num.subtract(2, constants.cC)),
              constants.muEffective
            ))
          ),
          numericValueAt(y, index)
        )
      )
  )
  const covarianceDiag = Arr.makeBy(dimension, (index) => {
    const rankOne = Num.multiply(numericValueAt(pC, index), numericValueAt(pC, index))
    const rankMu = Arr.reduce(
      Arr.makeBy(Arr.length(selectedElite), (position) => position),
      0,
      (sum, position) => {
        const observation = Arr.get(selectedElite, position).pipe(
          Option.getOrElse(() => new CmaEsObservation({ trialNumber: 0, vector: Arr.empty<number>(), value: 0 }))
        )
        const normalizedStep = Num.unsafeDivide(
          Num.subtract(vectorValueAt(observation.vector, index), vectorValueAt(current.mean, index)),
          current.sigma
        )
        const weight = Arr.get(weights, position).pipe(Option.getOrElse(() => 0))
        return Num.sum(sum, Num.multiply(weight, Num.multiply(normalizedStep, normalizedStep)))
      }
    )
    const decay = Num.sum(
      Num.subtract(Num.subtract(1, constants.c1), constants.cMu),
      Num.multiply(
        Num.multiply(Num.multiply(Num.subtract(1, hSigma), constants.c1), constants.cC),
        Num.subtract(2, constants.cC)
      )
    )
    const nextCovariance = Num.sum(
      Num.sum(
        Num.multiply(decay, covarianceValueAt(current.covarianceDiag, index)),
        Num.multiply(constants.c1, rankOne)
      ),
      Num.multiply(constants.cMu, rankMu)
    )

    return Num.clamp(nextCovariance, {
      minimum: 1e-12,
      maximum: 1e3
    })
  })

  return new CmaEsState({
    mean: weightedMean,
    sigma: nextSigma,
    covarianceDiag,
    pSigma,
    pC
  })
}

/**
 * Stable trial-number ordering for reconstructing CMA-ES generations.
 *
 * @since 0.1.0
 * @category operations
 */
export const trialOrder = Order.mapInput(Order.number, (observation: CmaEsObservation) => observation.trialNumber)
