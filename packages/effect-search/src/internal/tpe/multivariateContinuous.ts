/**
 * TPE multivariate continuous — joint Gaussian mixture sampling for correlated numeric dimensions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Chunk, Data, Effect, Match, Number as Num, Option } from "effect"

import * as Acquisition from "../../Acquisition.js"
import type * as Rng from "../../internal/rng.js"
import {
  diagonalGaussianMixtureLogDensity,
  sampleDiagonalGaussianMixture,
  scottsBandwidthVector
} from "../../internal/tpe/multivariateGaussian.js"
import { type TrialSplit } from "../../internal/tpe/splitTrials.js"
import type { Vector } from "../../Objective.js"
import type { InvalidSamplerConfig } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import { estimateCostForConfig } from "./costModel.js"
import {
  adapterForParameter,
  configFromCandidate,
  normalizeModelCandidate,
  vectorsFromSplit
} from "./multivariateContinuous/adapters.js"
import { drawMultivariateRolls, statsByDimension, uniformWeights, valueAt } from "./multivariateContinuous/kernels.js"

/** Candidate configurations and densities from correlated continuous sampling. */
export class MultivariateContinuousTrace extends Data.Class<{
  readonly parameterNames: Chunk.Chunk<string>
  readonly candidateConfigs: Chunk.Chunk<unknown>
  readonly logL: Vector
  readonly logG: Vector
  readonly scores: Vector
}> {}

/**
 * Builds a candidate trace for correlated continuous dimensions by fitting
 * diagonal Gaussian mixtures to the below/above splits and scoring each
 * candidate via the acquisition function.
 *
 * Returns `Option.none()` when fewer than 2 continuous dimensions are
 * present, since multivariate modeling requires at least two dimensions.
 *
 * @see {@link MultivariateContinuousTrace} for the output shape
 * @see {@link multivariateFromOptions} for the feature toggle
 * @since 0.1.0
 * @category sampling
 */
export const multivariateContinuousCandidateTrace = (
  rng: Rng.Rng,
  nCandidates: number,
  parametersInput: Iterable<SearchSpace.Parameter>,
  split: TrialSplit,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<Option.Option<MultivariateContinuousTrace>, InvalidSamplerConfig> => {
  const parameters = Arr.fromIterable(parametersInput)
  return Match.value(Num.lessThan(parameters.length, 2)).pipe(
    Match.when(true, () => Effect.succeedNone),
    Match.orElse(() =>
      Effect.gen(function*() {
        const adapters = yield* Effect.forEach(parameters, (parameter) => adapterForParameter(parameter))
        const belowVectors = vectorsFromSplit(adapters, split.below)
        const aboveVectors = vectorsFromSplit(adapters, split.above)
        const hasSufficientHistory = Bool.and(
          Num.greaterThan(belowVectors.length, 2),
          Num.greaterThan(aboveVectors.length, 2)
        )

        return yield* Match.value(hasSufficientHistory).pipe(
          Match.when(false, () => Effect.succeedNone),
          Match.orElse(() =>
            Effect.gen(function*() {
              const dimensionCount = adapters.length
              const belowStats = statsByDimension(belowVectors, dimensionCount)
              const aboveStats = statsByDimension(aboveVectors, dimensionCount)
              const belowSigmaVector = scottsBandwidthVector(
                belowVectors.length,
                dimensionCount,
                Arr.map(belowStats, (entry) => entry.stddev)
              )
              const aboveSigmaVector = scottsBandwidthVector(
                aboveVectors.length,
                dimensionCount,
                Arr.map(aboveStats, (entry) => entry.stddev)
              )
              const belowSigmas = Arr.makeBy(belowVectors.length, () => belowSigmaVector)
              const aboveSigmas = Arr.makeBy(aboveVectors.length, () => aboveSigmaVector)
              const belowWeights = uniformWeights(belowVectors.length)
              const aboveWeights = uniformWeights(aboveVectors.length)
              const rolls = yield* drawMultivariateRolls(rng, nCandidates, dimensionCount)
              const modelCandidates = Arr.map(rolls, (roll) =>
                sampleDiagonalGaussianMixture(
                  belowVectors,
                  belowSigmas,
                  belowWeights,
                  roll.componentRoll,
                  roll.valueRolls
                ))
              const normalizedCandidates = yield* Effect.forEach(
                modelCandidates,
                (candidate, candidateIndex) => normalizeModelCandidate(adapters, candidate, candidateIndex)
              )
              const candidateConfigs = Arr.map(
                normalizedCandidates,
                (candidateValues) => configFromCandidate(adapters, candidateValues)
              )
              const logL = Arr.map(
                modelCandidates,
                (candidate) => diagonalGaussianMixtureLogDensity(candidate, belowVectors, belowSigmas, belowWeights)
              )
              const logG = Arr.map(
                modelCandidates,
                (candidate) => diagonalGaussianMixtureLogDensity(candidate, aboveVectors, aboveSigmas, aboveWeights)
              )
              const scores = Arr.makeBy(modelCandidates.length, (index) =>
                Acquisition.score({
                  logL: valueAt(logL, index, Number.NEGATIVE_INFINITY),
                  logG: valueAt(logG, index, Number.NEGATIVE_INFINITY),
                  estimatedCost: Arr.get(candidateConfigs, index).pipe(
                    Option.flatMap((candidateConfig) => estimateCostForConfig(split, candidateConfig))
                  ),
                  roll: Arr.get(rolls, index).pipe(
                    Option.map((candidateRoll) => candidateRoll.componentRoll)
                  )
                }, acquisition))

              return Option.some(
                new MultivariateContinuousTrace({
                  parameterNames: Chunk.fromIterable(Arr.map(adapters, (adapter) => adapter.name)),
                  candidateConfigs: Chunk.fromIterable(candidateConfigs),
                  logL,
                  logG,
                  scores
                })
              )
            })
          )
        )
      })
    )
  )
}
