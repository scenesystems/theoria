/**
 * GP-BO suggestion logic for continuous single-objective spaces.
 *
 * @since 0.1.0
 */
import { sqrt } from "@scenesystems/effect-math/Numeric"
import { standardNormalCdf, standardNormalPdf, standardNormalTransform } from "@scenesystems/effect-math/Probability"
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Order } from "effect"

import type { Vector } from "../../../Objective.js"

import type { Name } from "../../../Acquisition.js"
import type { Context } from "../../../Sampler.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import * as Rng from "../../rng.js"
import { continuousDimensionsFromSpace, denormalizeVector, normalizedVectorFromConfig } from "../continuous.js"
import { minimumObserved } from "../math.js"
import { scalarObservationsFromContext } from "../objective.js"
import { rngByTrial } from "../rngByTrial.js"
import { buildPosterior, predictPosterior } from "./gaussianProcess.js"

/**
 * Normalized scalar observation used by GP-BO fitting and ranking.
 *
 * @since 0.1.0
 * @category models
 */
export class GpObservation extends Data.Class<{
  readonly trialNumber: number
  readonly vector: Vector
  readonly value: number
}> {}

/**
 * Candidate score record produced during acquisition evaluation.
 *
 * @since 0.1.0
 * @category models
 */
export class CandidateScore extends Data.Class<{
  readonly vector: Vector
  readonly score: number
}> {}

const explorationEpsilon = 0.01
const defaultAcquisition: Name = "ei"

const sampleUniformVector = (rng: Rng.Rng, dimensions: number) =>
  Match.value(Num.lessThanOrEqualTo(dimensions, 0)).pipe(
    Match.when(true, () => Effect.succeed(Arr.empty<number>())),
    Match.orElse(() => Effect.forEach(Arr.makeBy(dimensions, (index) => index), () => Rng.nextFloat(rng, 0, 1)))
  )

const expectedImprovementScore = (mean: number, best: number, variance: number): number => {
  const standardDeviation = sqrt(Num.max(variance, 1e-12))
  const improvement = Num.subtract(Num.subtract(best, mean), explorationEpsilon)
  const z = Num.unsafeDivide(improvement, standardDeviation)
  return Num.sum(
    Num.multiply(improvement, standardNormalCdf(z)),
    Num.multiply(standardDeviation, standardNormalPdf(z))
  )
}

const probabilityImprovementScore = (mean: number, best: number, variance: number): number => {
  const standardDeviation = sqrt(Num.max(variance, 1e-12))
  return standardNormalCdf(
    Num.unsafeDivide(Num.subtract(Num.subtract(best, mean), explorationEpsilon), standardDeviation)
  )
}

const thompsonScore = (mean: number, best: number, variance: number, roll: number): number => {
  const standardDeviation = sqrt(Num.max(variance, 1e-12))
  const sampledValue = Num.sum(mean, Num.multiply(standardDeviation, standardNormalTransform(roll)))
  return Num.subtract(best, sampledValue)
}

const acquisitionScore = (
  mean: number,
  best: number,
  variance: number,
  acquisition: Name,
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
  acquisition: Option.Option<Name>,
  space: SearchSpace.SearchSpace,
  context: Context
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

    return yield* Match.value(Num.lessThan(observations.length, nStartupTrials)).pipe(
      Match.when(true, () =>
        sampleUniformVector(rng, dimensions.length).pipe(
          Effect.map((startupCandidate) => denormalizeVector(dimensions, startupCandidate))
        )),
      Match.orElse(() => {
        const best = minimumObserved(Arr.map(observations, (observation) => observation.value), 0)
        const resolvedAcquisition = Option.getOrElse(acquisition, () => defaultAcquisition)
        const incumbent = Arr.head(Arr.sort(observations, observationOrder)).pipe(
          Option.map((observation) => observation.vector)
        )

        return buildPosterior(observations, lengthScale, noise).pipe(
          Option.match({
            onNone: () =>
              sampleUniformVector(rng, dimensions.length).pipe(
                Effect.map((fallbackCandidate) => denormalizeVector(dimensions, fallbackCandidate))
              ),
            onSome: (posterior) =>
              Effect.gen(function*() {
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
                    const prediction = predictPosterior(posterior, candidate)
                    const score = yield* acquisitionScore(
                      prediction.mean,
                      best,
                      prediction.variance,
                      resolvedAcquisition,
                      rng
                    )

                    return new CandidateScore({ vector: candidate, score })
                  }))
                const bestCandidate = Arr.head(scored).pipe(
                  Option.match({
                    onNone: () => Arr.empty<number>(),
                    onSome: (first) =>
                      Arr.reduce(Arr.drop(scored, 1), first, (currentBest, candidate) =>
                        Match.value(Num.greaterThan(candidate.score, currentBest.score)).pipe(
                          Match.when(true, () => candidate),
                          Match.orElse(() =>
                            currentBest
                          )
                        )).vector
                  })
                )

                return denormalizeVector(dimensions, bestCandidate)
              })
          })
        )
      })
    )
  })
