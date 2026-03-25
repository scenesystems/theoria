/**
 * CMA-ES suggestion logic for continuous single-objective spaces.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Number as Num, Option } from "effect"
import { standardNormalTransform } from "effect-math/Probability"

import * as Rng from "../../internal/rng.js"
import type { SuggestContext } from "../../Sampler/index.js"
import { rngByTrial } from "../../Sampler/shared/rngByTrial.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import {
  continuousDimensionsFromSpace,
  denormalizeVector,
  normalizedCenter,
  normalizedVectorFromConfig
} from "../shared/continuous.js"
import { scalarObservationsFromContext } from "../shared/objective.js"
import type { CmaEsState } from "./state.js"
import {
  cmaEsConstants,
  CmaEsObservation,
  covarianceValueAt,
  createInitialState,
  recombinationWeights,
  trialOrder,
  updateState
} from "./state.js"

const clamp01 = (value: number): number =>
  Num.clamp(value, {
    minimum: 0,
    maximum: 1
  })

const sampleStandardNormal = (rng: Rng.Rng): Effect.Effect<number> =>
  Effect.gen(function*() {
    const roll = yield* Rng.nextFloat(rng, 0, 1)
    return standardNormalTransform(roll)
  })

const sampleCandidate = (
  rng: Rng.Rng,
  state: CmaEsState
): Effect.Effect<Array<number>> =>
  Effect.forEach(state.mean, (value, index) =>
    sampleStandardNormal(rng).pipe(
      Effect.map((roll) =>
        clamp01(value + (state.sigma * Math.sqrt(covarianceValueAt(state.covarianceDiag, index)) * roll))
      )
    ))

export const suggest = (
  seed: number,
  sigma: number,
  populationSize: number,
  space: SearchSpace.SearchSpace,
  context: SuggestContext
) =>
  Effect.gen(function*() {
    const dimensions = yield* continuousDimensionsFromSpace("cma-es", space)
    const dimension = dimensions.length
    const mu = Num.max(1, Math.floor(populationSize / 2))
    const weights = recombinationWeights(mu)
    const constants = cmaEsConstants(dimension, weights)
    const observed = yield* scalarObservationsFromContext("cma-es", context)
    const observations = Arr.filterMap(observed, (entry) =>
      normalizedVectorFromConfig(dimensions, entry.config).pipe(
        Option.map((vector) =>
          new CmaEsObservation({
            trialNumber: entry.trialNumber,
            vector,
            value: entry.value
          })
        )
      ))
    const orderedByTrial = Arr.sort(observations, trialOrder)
    const completedGenerations = Math.floor(orderedByTrial.length / populationSize)
    const generations = Arr.makeBy(
      completedGenerations,
      (generationIndex) =>
        orderedByTrial.slice(generationIndex * populationSize, (generationIndex + 1) * populationSize)
    )
    const initialState = createInitialState(normalizedCenter(dimensions), sigma, dimension)
    const state = Arr.reduce(generations, initialState, (currentState, generation, index) =>
      updateState(currentState, generation, index + 1, weights, constants, mu, dimension))
    const rng = rngByTrial("cmaes", seed, context.nextTrialNumber)

    return denormalizeVector(dimensions, yield* sampleCandidate(rng, state))
  })
