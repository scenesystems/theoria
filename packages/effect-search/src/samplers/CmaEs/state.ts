/**
 * CMA-ES state evolution helpers.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Number as Num, Option, Order } from "effect"

import { l2Norm } from "../shared/math.js"

/**
 * Completed observation encoded for CMA-ES generation updates.
 *
 * @since 0.1.0
 * @category models
 */
export class CmaEsObservation extends Data.Class<{
  readonly trialNumber: number
  readonly vector: ReadonlyArray<number>
  readonly value: number
}> {}

/**
 * Mutable CMA-ES search state projected as an immutable value object.
 *
 * @since 0.1.0
 * @category models
 */
export class CmaEsState extends Data.Class<{
  readonly mean: ReadonlyArray<number>
  readonly sigma: number
  readonly covarianceDiag: ReadonlyArray<number>
  readonly pSigma: ReadonlyArray<number>
  readonly pC: ReadonlyArray<number>
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

const vectorValueAt = (vector: ReadonlyArray<number>, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => 0.5))

const numericValueAt = (vector: ReadonlyArray<number>, index: number, fallback = 0): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => fallback))

/**
 * Reads diagonal covariance values with unit fallback for missing entries.
 *
 * @since 0.1.0
 * @category operations
 */
export const covarianceValueAt = (vector: ReadonlyArray<number>, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => 1))

const zeros = (dimension: number): Array<number> => Arr.makeBy(dimension, () => 0)

/**
 * Creates the canonical CMA-ES initial state in normalized coordinates.
 *
 * @since 0.1.0
 * @category operations
 */
export const createInitialState = (
  mean: ReadonlyArray<number>,
  sigma: number,
  dimension: number
): CmaEsState =>
  new CmaEsState({
    mean,
    sigma,
    covarianceDiag: Arr.makeBy(dimension, () => 1),
    pSigma: zeros(dimension),
    pC: zeros(dimension)
  })

/**
 * Computes normalized recombination weights for the elite population.
 *
 * @since 0.1.0
 * @category operations
 */
export const recombinationWeights = (mu: number): Array<number> => {
  const rawWeights = Arr.makeBy(mu, (index) => Math.log(mu + 0.5) - Math.log(index + 1))
  const denominator = Arr.reduce(rawWeights, 0, (sum, weight) => sum + weight)
  return Arr.map(rawWeights, (weight) => weight / denominator)
}

const muEffective = (weights: ReadonlyArray<number>): number =>
  1 / Arr.reduce(weights, 0, (sum, weight) => sum + (weight * weight))

/**
 * Derives CMA-ES adaptation constants for a dimension and weight set.
 *
 * @since 0.1.0
 * @category operations
 */
export const cmaEsConstants = (dimensions: number, weights: ReadonlyArray<number>): CmaEsConstants => {
  const muEff = muEffective(weights)
  const cSigma = (muEff + 2) / (dimensions + muEff + 5)
  const dSigma = 1 + (2 * Num.max(0, Math.sqrt((muEff - 1) / (dimensions + 1)) - 1)) + cSigma
  const cC = (4 + (muEff / dimensions)) / (dimensions + 4 + (2 * muEff / dimensions))
  const c1 = 2 / (((dimensions + 1.3) * (dimensions + 1.3)) + muEff)
  const cMuBase = (2 * (muEff - 2 + (1 / muEff))) / (((dimensions + 2) * (dimensions + 2)) + muEff)

  return new CmaEsConstants({
    cSigma,
    dSigma,
    cC,
    c1,
    cMu: Num.min(1 - c1, cMuBase),
    muEffective: muEff,
    expectedNorm: Math.sqrt(dimensions) * (1 - (1 / (4 * dimensions)) + (1 / (21 * dimensions * dimensions))),
    hSigmaThreshold: 1.4 + (2 / (dimensions + 1))
  })
}

const weightedEliteMean = (
  elite: ReadonlyArray<CmaEsObservation>,
  weights: ReadonlyArray<number>,
  dimension: number
): Array<number> =>
  Arr.makeBy(dimension, (index) =>
    Arr.reduce(
      Arr.makeBy(elite.length, (position) => position),
      0,
      (sum, position) =>
        sum + ((weights[position] ?? 0) * vectorValueAt(elite[position]?.vector ?? Arr.empty<number>(), index))
    ))

/**
 * Advances CMA-ES state by one completed generation.
 *
 * @since 0.1.0
 * @category operations
 */
export const updateState = (
  current: CmaEsState,
  generation: ReadonlyArray<CmaEsObservation>,
  generationNumber: number,
  weights: ReadonlyArray<number>,
  constants: CmaEsConstants,
  mu: number,
  dimension: number
): CmaEsState => {
  const elite = Arr.sort(generation, Order.mapInput(Order.number, (observation: CmaEsObservation) => observation.value))
    .slice(0, mu)
  const weightedMean = weightedEliteMean(elite, weights, dimension)
  const y = Arr.makeBy(
    dimension,
    (index) => (vectorValueAt(weightedMean, index) - vectorValueAt(current.mean, index)) / current.sigma
  )
  const inverseRootC = Arr.makeBy(
    dimension,
    (index) => numericValueAt(y, index) / Math.sqrt(Num.max(covarianceValueAt(current.covarianceDiag, index), 1e-12))
  )
  const pSigma = Arr.makeBy(
    dimension,
    (index) =>
      ((1 - constants.cSigma) * (current.pSigma[index] ?? 0)) +
      (Math.sqrt(constants.cSigma * (2 - constants.cSigma) * constants.muEffective) *
        numericValueAt(inverseRootC, index))
  )
  const normPSigma = l2Norm(pSigma)
  const sigmaScale = Math.exp((constants.cSigma / constants.dSigma) * ((normPSigma / constants.expectedNorm) - 1))
  const nextSigma = Num.clamp(current.sigma * sigmaScale, {
    minimum: 1e-6,
    maximum: 2
  })
  const normCorrection = Math.sqrt(1 - ((1 - constants.cSigma) ** (2 * generationNumber)))
  const hSigmaMetric = (normPSigma / normCorrection) / constants.expectedNorm
  const hSigma = Num.lessThan(hSigmaMetric, constants.hSigmaThreshold) ? 1 : 0
  const pC = Arr.makeBy(
    dimension,
    (index) =>
      ((1 - constants.cC) * (current.pC[index] ?? 0)) +
      (hSigma * Math.sqrt(constants.cC * (2 - constants.cC) * constants.muEffective) * numericValueAt(y, index))
  )
  const covarianceDiag = Arr.makeBy(dimension, (index) => {
    const rankOne = numericValueAt(pC, index) * numericValueAt(pC, index)
    const rankMu = Arr.reduce(
      Arr.makeBy(elite.length, (position) => position),
      0,
      (sum, position) => {
        const observation = elite[position]
        const normalizedStep =
          (vectorValueAt(observation?.vector ?? Arr.empty<number>(), index) - vectorValueAt(current.mean, index)) /
          current.sigma
        return sum + ((weights[position] ?? 0) * normalizedStep * normalizedStep)
      }
    )
    const decay = 1 -
      constants.c1 -
      constants.cMu +
      ((1 - hSigma) * constants.c1 * constants.cC * (2 - constants.cC))
    const nextCovariance = (decay * covarianceValueAt(current.covarianceDiag, index)) + (constants.c1 * rankOne) +
      (constants.cMu * rankMu)

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
