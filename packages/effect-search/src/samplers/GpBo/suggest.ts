/**
 * GP-BO suggestion logic for continuous single-objective spaces.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option } from "effect"

import * as Rng from "../../internal/rng.js"
import type { BuiltInAcquisitionName, SuggestContext } from "../../Sampler/index.js"
import { rngByTrial } from "../../Sampler/shared/rngByTrial.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { continuousDimensionsFromSpace, denormalizeVector, normalizedVectorFromConfig } from "../shared/continuous.js"
import { scalarObservationsFromContext } from "../shared/objective.js"
import { scoreAcquisition } from "../Tpe/acquisition/index.js"

export class GpObservation extends Data.Class<{
  readonly vector: ReadonlyArray<number>
  readonly value: number
}> {}

export class CandidateScore extends Data.Class<{
  readonly vector: ReadonlyArray<number>
  readonly score: number
}> {}

const squaredDistance = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): number =>
  Arr.reduce(left, 0, (distance, value, index) => {
    const other = Arr.get(right, index).pipe(Option.getOrElse(() => 0.5))
    const delta = value - other
    return distance + (delta * delta)
  })

const kernelWeight = (distanceSquared: number, lengthScale: number): number =>
  Math.E ** (-(distanceSquared / (2 * lengthScale * lengthScale)))

const sampleUniformVector = (rng: Rng.Rng, dimensions: number): Effect.Effect<Array<number>> =>
  dimensions <= 0
    ? Effect.succeed([])
    : Effect.forEach(Arr.makeBy(dimensions, (index) => index), () => Rng.nextFloat(rng, 0, 1))

const weightedMean = (weights: ReadonlyArray<number>, observations: ReadonlyArray<GpObservation>): number => {
  const weighted = Arr.reduce(weights, 0, (sum, weight, index) => {
    const value = Arr.get(observations, index).pipe(
      Option.map((observation) => observation.value),
      Option.getOrElse(() => 0)
    )
    return sum + (weight * value)
  })
  const totalWeight = Arr.reduce(weights, 0, (sum, weight) => sum + weight)

  return totalWeight <= 0 ? 0 : weighted / totalWeight
}

const predictiveVariance = (weights: ReadonlyArray<number>, noise: number): number => {
  const totalWeight = Arr.reduce(weights, 0, (sum, weight) => sum + weight)

  return (1 / (1 + totalWeight)) + noise
}

const acquisitionScore = (
  mean: number,
  best: number,
  variance: number,
  acquisition: Option.Option<BuiltInAcquisitionName>,
  roll: Option.Option<number>
): number => {
  const context = {
    logL: -mean,
    logG: -best,
    estimatedCost: Option.some(1 / Num.max(variance, 1e-9)),
    roll
  }

  return Option.match(acquisition, {
    onNone: () => scoreAcquisition(context),
    onSome: (resolvedAcquisition) => scoreAcquisition(context, resolvedAcquisition)
  })
}

const predictCandidate = (
  candidate: ReadonlyArray<number>,
  observations: ReadonlyArray<GpObservation>,
  lengthScale: number,
  noise: number
): { readonly mean: number; readonly variance: number } => {
  const weights = Arr.map(
    observations,
    (observation) => kernelWeight(squaredDistance(candidate, observation.vector), lengthScale)
  )

  return {
    mean: weightedMean(weights, observations),
    variance: predictiveVariance(weights, noise)
  }
}

const fallbackScore = (candidate: ReadonlyArray<number>): number =>
  Arr.reduce(candidate, 0, (sum, value) => sum - value)

const minimumObserved = (observations: ReadonlyArray<GpObservation>): number =>
  Arr.head(observations).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (first) =>
        Arr.reduce(
          Arr.drop(observations, 1),
          first.value,
          (current, observation) => Num.min(current, observation.value)
        )
    })
  )

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
        Option.map((vector) => new GpObservation({ vector, value: entry.value }))
      ))
    const rng = rngByTrial("gpbo", seed, context.nextTrialNumber)

    if (Num.lessThan(observations.length, nStartupTrials)) {
      const startupCandidate = yield* sampleUniformVector(rng, dimensions.length)
      return denormalizeVector(dimensions, startupCandidate)
    }

    const best = minimumObserved(observations)
    const candidateVectors = yield* Effect.forEach(
      Arr.makeBy(nCandidates, (index) => index),
      () => sampleUniformVector(rng, dimensions.length)
    )

    const scored = yield* Effect.forEach(candidateVectors, (candidate) =>
      Effect.gen(function*() {
        const roll = yield* Rng.nextFloat(rng, 0, 1)
        const prediction = predictCandidate(candidate, observations, lengthScale, noise)

        return new CandidateScore({
          vector: candidate,
          score: Match.value(observations.length).pipe(
            Match.when(0, () => fallbackScore(candidate)),
            Match.orElse(() =>
              acquisitionScore(prediction.mean, best, prediction.variance, acquisition, Option.some(roll))
            )
          )
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
