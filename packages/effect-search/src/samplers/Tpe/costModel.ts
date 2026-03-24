/**
 * TPE cost model — similarity-weighted cost estimation for candidate configurations.
 *
 * @since 0.1.0
 */
import { Array as Arr, Equal, Match, Number as Num, Option, Predicate, Record } from "effect"

import type { PrimitiveChoice } from "../../contracts/Distribution.js"
import { valueFromConfig } from "../../internal/configAccess.js"
import type { CompletedTrialForSplit, TrialSplit } from "../../internal/tpe/splitTrials.js"

const BACKGROUND_SIMILARITY = 0.25

const finitePositive = (value: number): boolean => Number.isFinite(value) && Num.greaterThan(value, 0)

const finiteNonNegative = (value: number): boolean => Number.isFinite(value) && Num.greaterThanOrEqualTo(value, 0)

const costSamples = (
  split: TrialSplit
): ReadonlyArray<CompletedTrialForSplit & { readonly cost: number }> =>
  Arr.filter(
    Arr.appendAll(split.below, split.above),
    (trial): trial is CompletedTrialForSplit & { readonly cost: number } =>
      Option.fromNullable(trial.cost).pipe(
        Option.filter(finitePositive),
        Option.isSome
      )
  )

const finiteNumber = (value: unknown): Option.Option<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (numericValue) =>
      Match.value(Number.isFinite(numericValue)).pipe(
        Match.when(true, () => Option.some(numericValue)),
        Match.orElse(() => Option.none())
      )),
    Match.orElse(() => Option.none())
  )

const meanCost = (
  samples: ReadonlyArray<CompletedTrialForSplit & { readonly cost: number }>
): Option.Option<number> =>
  Match.value(samples.length <= 0).pipe(
    Match.when(true, () => Option.none()),
    Match.orElse(() =>
      Option.some(
        Num.unsafeDivide(
          Arr.reduce(samples, 0, (total, sample) => Num.sum(total, sample.cost)),
          samples.length
        )
      )
    )
  )

const weightedMeanCost = (
  weightedSamples: ReadonlyArray<{ readonly weight: number; readonly cost: number }>
): Option.Option<number> => {
  const totalWeight = Arr.reduce(weightedSamples, 0, (total, sample) => Num.sum(total, sample.weight))

  return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
    Match.when(true, () => Option.none()),
    Match.orElse(() =>
      Option.some(
        Num.unsafeDivide(
          Arr.reduce(weightedSamples, 0, (total, sample) => Num.sum(total, sample.weight * sample.cost)),
          totalWeight
        )
      )
    )
  )
}

const numericSimilarity = (left: number, right: number): number =>
  Num.unsafeDivide(1, Num.sum(1, Math.abs(left - right)))

const primitiveSimilarity = (left: unknown, right: unknown): number =>
  Match.value(Equal.equals(left, right)).pipe(
    Match.when(true, () => 1),
    Match.orElse(() => BACKGROUND_SIMILARITY)
  )

/**
 * Estimates trial cost for a numeric parameter candidate using
 * distance-weighted similarity to observed costs. Closer observed
 * values contribute more to the estimate, enabling cost-aware
 * acquisition that avoids expensive regions of the search space.
 *
 * @see {@link estimateCostForCategoricalParameter} for categorical parameters
 * @see {@link estimateCostForConfig} for full-config cost estimation
 * @since 0.1.0
 * @category scoring
 */
export const estimateCostForNumericParameter = (
  split: TrialSplit,
  parameterName: string,
  candidateValue: number
): Option.Option<number> => {
  const samples = costSamples(split)
  const weightedSamples = Arr.filterMap(samples, (sample) =>
    valueFromConfig(sample.config, parameterName).pipe(
      Option.flatMap(finiteNumber),
      Option.map((observed) => ({
        weight: numericSimilarity(candidateValue, observed),
        cost: sample.cost
      }))
    ))

  return weightedMeanCost(weightedSamples).pipe(
    Option.orElse(() => meanCost(samples))
  )
}

/**
 * Estimates trial cost for a categorical parameter candidate using
 * equality-based similarity to observed costs. Matching categories
 * receive full weight while mismatches receive a background
 * similarity of 0.25, providing a soft cost signal for discrete choices.
 *
 * @see {@link estimateCostForNumericParameter} for continuous parameters
 * @see {@link estimateCostForConfig} for full-config cost estimation
 * @since 0.1.0
 * @category scoring
 */
export const estimateCostForCategoricalParameter = (
  split: TrialSplit,
  parameterName: string,
  candidateValue: PrimitiveChoice
): Option.Option<number> => {
  const samples = costSamples(split)
  const weightedSamples = Arr.filterMap(samples, (sample) =>
    valueFromConfig(sample.config, parameterName).pipe(
      Option.map((observed) => ({
        weight: primitiveSimilarity(observed, candidateValue),
        cost: sample.cost
      }))
    ))

  return weightedMeanCost(weightedSamples).pipe(
    Option.orElse(() => meanCost(samples))
  )
}

const keySimilarity = (
  candidateValue: unknown,
  sampleValue: unknown
): number =>
  Option.all([finiteNumber(candidateValue), finiteNumber(sampleValue)]).pipe(
    Option.match({
      onNone: () =>
        Match.value(Equal.equals(candidateValue, sampleValue)).pipe(
          Match.when(true, () => 1),
          Match.orElse(() => BACKGROUND_SIMILARITY)
        ),
      onSome: ([candidateNumeric, sampleNumeric]) => numericSimilarity(candidateNumeric, sampleNumeric)
    })
  )

/**
 * Estimates trial cost for a full candidate configuration by averaging
 * per-key similarity-weighted costs across all parameters. Automatically
 * detects numeric vs. categorical keys and applies the appropriate
 * similarity metric for each.
 *
 * @see {@link estimateCostForNumericParameter} for per-numeric-key similarity
 * @see {@link estimateCostForCategoricalParameter} for per-categorical-key similarity
 * @since 0.1.0
 * @category scoring
 */
export const estimateCostForConfig = (
  split: TrialSplit,
  candidateConfig: unknown
): Option.Option<number> => {
  const samples = costSamples(split)
  const candidateEntries = Match.value(candidateConfig).pipe(
    Match.when(Predicate.isRecord, (record) => Record.toEntries(record)),
    Match.orElse(() => Arr.empty<readonly [string, unknown]>())
  )
  const weightedSamples = Arr.map(samples, (sample) => {
    const similarity = Match.value(candidateEntries.length <= 0).pipe(
      Match.when(true, () => 1),
      Match.orElse(() =>
        Num.unsafeDivide(
          Arr.reduce(candidateEntries, 0, (total, [key, candidateValue]) =>
            Num.sum(
              total,
              keySimilarity(
                candidateValue,
                valueFromConfig(sample.config, key).pipe(Option.getOrElse(() => undefined))
              )
            )),
          candidateEntries.length
        )
      )
    )

    return {
      weight: similarity,
      cost: sample.cost
    }
  })

  return weightedMeanCost(weightedSamples).pipe(
    Option.orElse(() => meanCost(samples))
  )
}

/**
 * Computes the mean observed objective variance across all trials in
 * a split, used for noise-aware Parzen estimation. Returns `None`
 * when no trials carry finite non-negative variance values,
 * signaling the estimator to use default bandwidth.
 *
 * @see {@link TrialSplit} for the below/above trial partition
 * @see {@link estimateCostForConfig} for the companion cost estimation
 * @since 0.1.0
 * @category scoring
 */
export const objectiveVarianceFromSplit = (split: TrialSplit): Option.Option<number> => {
  const variances = Arr.filterMap(
    Arr.appendAll(split.below, split.above),
    (trial) => Option.fromNullable(trial.variance).pipe(Option.filter(finiteNonNegative))
  )

  return Match.value(variances.length <= 0).pipe(
    Match.when(true, () => Option.none()),
    Match.orElse(() =>
      Option.some(
        Num.unsafeDivide(
          Arr.reduce(variances, 0, (total, variance) => Num.sum(total, variance)),
          variances.length
        )
      )
    )
  )
}
