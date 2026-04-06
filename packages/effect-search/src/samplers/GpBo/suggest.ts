/**
 * GP-BO suggestion logic for continuous single-objective spaces.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Order } from "effect"
import { sqrt } from "effect-math/Numeric"
import { standardNormalCdf, standardNormalPdf, standardNormalTransform } from "effect-math/Probability"

import * as Rng from "../../internal/rng.js"
import type { BuiltInAcquisitionName, SuggestContext } from "../../Sampler/index.js"
import { rngByTrial } from "../../Sampler/shared/rngByTrial.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { continuousDimensionsFromSpace, denormalizeVector, normalizedVectorFromConfig } from "../shared/continuous.js"
import { minimumObserved } from "../shared/math.js"
import { scalarObservationsFromContext } from "../shared/objective.js"
import { buildPosterior, predictPosterior } from "./gaussianProcess.js"

/**
 * Normalized scalar observation used by GP-BO fitting and ranking.
 *
 * @since 0.1.0
 * @category models
 */
export class GpObservation extends Data.Class<{
  readonly trialNumber: number
  readonly vector: ReadonlyArray<number>
  readonly value: number
}> {}

/**
 * Candidate score record produced during acquisition evaluation.
 *
 * @since 0.1.0
 * @category models
 */
export class CandidateScore extends Data.Class<{
  readonly vector: ReadonlyArray<number>
  readonly score: number
}> {}

const EXPLORATION_EPSILON = 0.01
const DEFAULT_ACQUISITION: BuiltInAcquisitionName = "ei"

const sampleUniformVector = (rng: Rng.Rng, dimensions: number): Effect.Effect<Array<number>> =>
  dimensions <= 0
    ? Effect.succeed([])
    : Effect.forEach(Arr.makeBy(dimensions, (index) => index), () => Rng.nextFloat(rng, 0, 1))

const expectedImprovementScore = (mean: number, best: number, variance: number): number => {
  const standardDeviation = sqrt(Num.max(variance, 1e-12))
  const improvement = best - mean - EXPLORATION_EPSILON
  const z = improvement / standardDeviation
  return (improvement * standardNormalCdf(z)) + (standardDeviation * standardNormalPdf(z))
}

const probabilityImprovementScore = (mean: number, best: number, variance: number): number => {
  const standardDeviation = sqrt(Num.max(variance, 1e-12))
  return standardNormalCdf((best - mean - EXPLORATION_EPSILON) / standardDeviation)
}

const thompsonScore = (mean: number, best: number, variance: number, roll: number): number => {
  const standardDeviation = sqrt(Num.max(variance, 1e-12))
  const sampledValue = mean + (standardDeviation * standardNormalTransform(roll))
  return best - sampledValue
}

const acquisitionScore = (
  mean: number,
  best: number,
  variance: number,
  acquisition: BuiltInAcquisitionName,
  rng: Rng.Rng
): Effect.Effect<number> =>
  Match.value(acquisition).pipe(
    Match.when("ei", () => Effect.succeed(expectedImprovementScore(mean, best, variance))),
    Match.when("pi", () => Effect.succeed(probabilityImprovementScore(mean, best, variance))),
    Match.when("thompson", () =>
      Rng.nextFloat(rng, 0, 1).pipe(
        Effect.map((roll) => thompsonScore(mean, best, variance, roll))
      )),
    Match.exhaustive
  )

const observationOrder = Order.mapInput(Order.number, (observation: GpObservation) => observation.value)

/**
 * Suggests the next GP-BO candidate for continuous single-objective search
 * spaces.
 *
 * @since 0.1.0
 * @category operations
 */
export const suggest = (
  seed: number,
  nStartupTrials: number,
  nCandidates: number,
  lengthScale: number,
  noise: number,
  acquisition: Option.Option<BuiltInAcquisitionName>,
  space: SearchSpace.SearchSpace,
  context: SuggestContext
) =>
  Effect.gen(function*() {
    const dimensions = yield* continuousDimensionsFromSpace("gp-bo", space)
    const observed = yield* scalarObservationsFromContext("gp-bo", context)
    const observations = Arr.filterMap(observed, (entry) =>
      normalizedVectorFromConfig(dimensions, entry.config).pipe(
        Option.map((vector) =>
          new GpObservation({
            trialNumber: entry.trialNumber,
            vector,
            value: entry.value
          })
        )
      ))
    const rng = rngByTrial("gpbo", seed, context.nextTrialNumber)

    if (Num.lessThan(observations.length, nStartupTrials)) {
      const startupCandidate = yield* sampleUniformVector(rng, dimensions.length)
      return denormalizeVector(dimensions, startupCandidate)
    }

    const best = minimumObserved(Arr.map(observations, (observation) => observation.value), 0)
    const resolvedAcquisition = Option.getOrElse(acquisition, () => DEFAULT_ACQUISITION)
    const incumbent = Arr.head(Arr.sort(observations, observationOrder)).pipe(
      Option.map((observation) => observation.vector)
    )
    const posterior = buildPosterior(observations, lengthScale, noise)

    if (Option.isNone(posterior)) {
      const fallbackCandidate = yield* sampleUniformVector(rng, dimensions.length)
      return denormalizeVector(dimensions, fallbackCandidate)
    }

    const candidateVectors = yield* Effect.forEach(
      Arr.makeBy(nCandidates, (index) => index),
      () => sampleUniformVector(rng, dimensions.length)
    )
    const candidates = Option.match(incumbent, {
      onNone: () => candidateVectors,
      onSome: (vector) => Arr.prepend(candidateVectors, vector)
    })

    const scored = yield* Effect.forEach(candidates, (candidate) =>
      Effect.gen(function*() {
        const prediction = predictPosterior(posterior.value, candidate)
        const score = yield* acquisitionScore(prediction.mean, best, prediction.variance, resolvedAcquisition, rng)

        return new CandidateScore({
          vector: candidate,
          score
        })
      }))

    const bestCandidate = Arr.head(scored).pipe(
      Option.match({
        onNone: () => Arr.empty<number>(),
        onSome: (first) =>
          Arr.reduce(Arr.drop(scored, 1), first, (currentBest, candidate) =>
            Num.greaterThan(candidate.score, currentBest.score)
              ? candidate
              : currentBest).vector
      })
    )

    return denormalizeVector(dimensions, bestCandidate)
  })
