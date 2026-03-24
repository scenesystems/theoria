/**
 * TPE multivariate continuous — joint Gaussian mixture sampling for correlated numeric dimensions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option } from "effect"

import type { InvalidSamplerConfig } from "../../Errors/index.js"
import type * as Rng from "../../internal/rng.js"
import {
  diagonalGaussianMixtureLogDensity,
  sampleDiagonalGaussianMixture,
  scottsBandwidthVector
} from "../../internal/tpe/multivariateGaussian.js"
import { type TrialSplit } from "../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName, scoreAcquisition } from "./acquisition/index.js"
import { estimateCostForConfig } from "./costModel.js"
import {
  adapterForParameter,
  configFromCandidate,
  normalizeModelCandidate,
  vectorsFromSplit
} from "./multivariateContinuous/adapters.js"
import { drawMultivariateRolls, statsByDimension, uniformWeights, valueAt } from "./multivariateContinuous/kernels.js"
import { MultivariateContinuousTrace } from "./multivariateContinuous/model.js"

export {
  /**
   * Trace record capturing candidate configs, log-densities, and scores for multivariate continuous parameters.
   *
   * @since 0.1.0
   * @category models
   */
  MultivariateContinuousTrace
}

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
  parameters: ReadonlyArray<SearchSpace.ParameterMetadata>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<Option.Option<MultivariateContinuousTrace>, InvalidSamplerConfig> =>
  Match.value(Num.lessThan(parameters.length, 2)).pipe(
    Match.when(true, () => Effect.succeed(Option.none())),
    Match.orElse(() =>
      Effect.gen(function*() {
        const adapters = yield* Effect.forEach(parameters, (parameter) => adapterForParameter(parameter))
        const belowVectors = vectorsFromSplit(adapters, split.below)
        const aboveVectors = vectorsFromSplit(adapters, split.above)
        const hasSufficientHistory = belowVectors.length > 2 && aboveVectors.length > 2

        if (!hasSufficientHistory) {
          return Option.none()
        }

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

        const normalizedCandidates = yield* Effect.forEach(modelCandidates, (candidate, candidateIndex) =>
          normalizeModelCandidate(adapters, candidate, candidateIndex))
        const candidateConfigs = Arr.map(normalizedCandidates, (candidateValues) =>
          configFromCandidate(adapters, candidateValues))
        const logL = Arr.map(modelCandidates, (candidate) =>
          diagonalGaussianMixtureLogDensity(candidate, belowVectors, belowSigmas, belowWeights))
        const logG = Arr.map(modelCandidates, (candidate) =>
          diagonalGaussianMixtureLogDensity(candidate, aboveVectors, aboveSigmas, aboveWeights))
        const scores = Arr.makeBy(modelCandidates.length, (index) =>
          scoreAcquisition({
            logL: valueAt(logL, index, Number.NEGATIVE_INFINITY),
            logG: valueAt(logG, index, Number.NEGATIVE_INFINITY),
            estimatedCost: Arr.get(candidateConfigs, index).pipe(
              Option.flatMap((candidateConfig) =>
                estimateCostForConfig(split, candidateConfig)
              )
            ),
            roll: Arr.get(rolls, index).pipe(Option.map((candidateRoll) =>
              candidateRoll.componentRoll
            ))
          }, acquisition))

        return Option.some(
          new MultivariateContinuousTrace({
            parameterNames: Arr.map(adapters, (adapter) =>
              adapter.name),
            candidateConfigs,
            logL,
            logG,
            scores
          })
        )
      })
    )
  )
