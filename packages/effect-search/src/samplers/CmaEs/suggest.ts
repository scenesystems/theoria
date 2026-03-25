/**
 * CMA-ES suggestion logic for continuous single-objective spaces.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Number as Num, Option, Order } from "effect"

import * as Float64 from "../../internal/float64.js"
import * as Rng from "../../internal/rng.js"
import type { SuggestContext } from "../../Sampler/index.js"
import { rngByTrial } from "../../Sampler/shared/rngByTrial.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import {
  type ContinuousDimension,
  continuousDimensionsFromSpace,
  denormalizeVector,
  normalizedCenter,
  normalizedVectorFromConfig
} from "../shared/continuous.js"
import { scalarObservationsFromContext } from "../shared/objective.js"

export class CmaEsObservation extends Data.Class<{
  readonly vector: ReadonlyArray<number>
  readonly value: number
}> {}

const clamp01 = (value: number): number =>
  Num.clamp(value, {
    minimum: 0,
    maximum: 1
  })

const vectorValueAt = (vector: ReadonlyArray<number>, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => 0.5))

const squaredDistance = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): number =>
  Arr.reduce(left, 0, (distance, value, index) => {
    const delta = value - vectorValueAt(right, index)
    return distance + (delta * delta)
  })

const meanAtIndex = (values: ReadonlyArray<CmaEsObservation>, index: number): number =>
  Arr.reduce(values, 0, (sum, observation) => sum + vectorValueAt(observation.vector, index)) / values.length

const eliteMean = (
  dimensions: ReadonlyArray<ContinuousDimension>,
  values: ReadonlyArray<CmaEsObservation>
): ReadonlyArray<number> => Arr.makeBy(dimensions.length, (index) => meanAtIndex(values, index))

const adaptiveSigma = (
  baseSigma: number,
  mean: ReadonlyArray<number>,
  elite: ReadonlyArray<CmaEsObservation>
): number => {
  const spread =
    Arr.reduce(elite, 0, (sum, observation) => sum + Float64.sqrt(squaredDistance(observation.vector, mean))) /
    elite.length

  return Num.clamp(baseSigma * (0.5 + spread), {
    minimum: 0.05,
    maximum: 0.9
  })
}

const sampleStandardNormal = (rng: Rng.Rng): Effect.Effect<number> =>
  Effect.gen(function*() {
    const first = yield* Rng.nextFloat(rng, 1e-12, 1)
    const second = yield* Rng.nextFloat(rng, 0, 1)
    const radius = Float64.sqrt(-2 * Float64.log(first))

    return radius * Math.cos(2 * Float64.PI * second)
  })

const sampleCandidate = (
  rng: Rng.Rng,
  mean: ReadonlyArray<number>,
  sigma: number
): Effect.Effect<Array<number>> =>
  Effect.forEach(mean, (value) =>
    sampleStandardNormal(rng).pipe(
      Effect.map((roll) => clamp01(value + (sigma * roll)))
    ))

const candidateScore = (
  candidate: ReadonlyArray<number>,
  mean: ReadonlyArray<number>,
  observations: ReadonlyArray<CmaEsObservation>
): number => {
  const exploitationPenalty = squaredDistance(candidate, mean)
  const novelty = Arr.head(observations).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (first) =>
        Arr.reduce(
          Arr.drop(observations, 1),
          squaredDistance(candidate, first.vector),
          (minimum, observation) => Num.min(minimum, squaredDistance(candidate, observation.vector))
        )
    })
  )

  return novelty - exploitationPenalty
}

const observationOrder = Order.mapInput(Order.number, (observation: CmaEsObservation) => observation.value)

export const suggest = (
  seed: number,
  sigma: number,
  populationSize: number,
  space: SearchSpace.SearchSpace,
  context: SuggestContext
) =>
  Effect.gen(function*() {
    const dimensions = yield* continuousDimensionsFromSpace("cma-es", space)
    const observed = yield* scalarObservationsFromContext("cma-es", context)
    const observations = Arr.filterMap(observed, (entry) =>
      normalizedVectorFromConfig(dimensions, entry.config).pipe(
        Option.map((vector) => new CmaEsObservation({ vector, value: entry.value }))
      ))
    const eliteCount = Num.max(1, Math.floor(populationSize / 2))
    const elite = Arr.sort(observations, observationOrder).slice(0, eliteCount)
    const hasElite = Option.isSome(Arr.head(elite))
    const mean = hasElite ? eliteMean(dimensions, elite) : normalizedCenter(dimensions)
    const effectiveSigma = hasElite ? adaptiveSigma(sigma, mean, elite) : sigma
    const rng = rngByTrial("cmaes", seed, context.nextTrialNumber)
    const sampled = yield* Effect.forEach(
      Arr.makeBy(populationSize, (index) => index),
      () => sampleCandidate(rng, mean, effectiveSigma)
    )
    const candidates = Arr.prepend(sampled, mean)
    const best = Arr.reduce(
      candidates,
      candidates[0] ?? normalizedCenter(dimensions),
      (currentBest, candidate) => {
        const currentScore = candidateScore(currentBest, mean, observations)
        const candidateScoreValue = candidateScore(candidate, mean, observations)

        return Num.greaterThan(candidateScoreValue, currentScore)
          ? candidate
          : currentBest
      }
    )

    return denormalizeVector(dimensions, best)
  })
