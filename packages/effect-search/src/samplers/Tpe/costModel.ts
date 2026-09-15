/**
 * TPE cost model — similarity-weighted cost estimation for candidate configurations.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Equal, Match, Number as Num, Option, Predicate, Record, Schema } from "effect"

import type { PrimitiveChoice } from "../../contracts/Distribution.js"
import { valueFromConfig } from "../../internal/configAccess.js"
import * as Float64 from "../../internal/float64.js"
import { CompletedTrialForSplit, type TrialSplit } from "../../internal/tpe/splitTrials.js"

const BACKGROUND_SIMILARITY = 0.25

const isFinite = Schema.is(Schema.Finite)
const isNonNaN = Schema.is(Schema.NonNaN)

const finitePositive = (value: number): boolean =>
  Boolean.and(isFinite(value), Boolean.and(isNonNaN(value), Num.greaterThan(value, 0)))

const finiteNonNegative = (value: number): boolean =>
  Boolean.and(isFinite(value), Boolean.and(isNonNaN(value), Num.greaterThanOrEqualTo(value, 0)))

class CostSample extends Schema.Class<CostSample>("effect-search/CostSample")({
  trial: CompletedTrialForSplit,
  cost: Schema.Number
}) {}

class WeightedCostSample extends Schema.Class<WeightedCostSample>("effect-search/WeightedCostSample")({
  weight: Schema.Number,
  cost: Schema.Number
}) {}

type CostSamples = Schema.Array$<typeof CostSample>["Type"]
type WeightedCostSamples = Schema.Array$<typeof WeightedCostSample>["Type"]

const costSamples = (split: TrialSplit): CostSamples =>
  Arr.filterMap(
    Arr.appendAll(split.below, split.above),
    (trial) =>
      Option.fromNullable(trial.cost).pipe(
        Option.filter(finitePositive),
        Option.map((cost) => new CostSample({ trial, cost }))
      )
  )

const finiteNumber = (value: unknown): Option.Option<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (numericValue) =>
      Match.value(isFinite(numericValue)).pipe(
        Match.when(true, () => Option.some(numericValue)),
        Match.orElse(() => Option.none())
      )),
    Match.orElse(() => Option.none())
  )

const meanCost = (
  samples: CostSamples
): Option.Option<number> =>
  Match.value(Arr.isEmptyReadonlyArray(samples)).pipe(
    Match.when(true, () => Option.none()),
    Match.orElse(() =>
      Option.some(
        Num.unsafeDivide(
          Arr.reduce(samples, 0, (total, sample) => Num.sum(total, sample.cost)),
          Arr.length(samples)
        )
      )
    )
  )

const weightedMeanCost = (
  weightedSamples: WeightedCostSamples
): Option.Option<number> => {
  const totalWeight = Arr.reduce(weightedSamples, 0, (total, sample) => Num.sum(total, sample.weight))

  return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
    Match.when(true, () => Option.none()),
    Match.orElse(() =>
      Option.some(
        Num.unsafeDivide(
          Arr.reduce(weightedSamples, 0, (total, sample) => Num.sum(total, Num.multiply(sample.weight, sample.cost))),
          totalWeight
        )
      )
    )
  )
}

const numericSimilarity = (left: number, right: number): number =>
  Num.unsafeDivide(1, Num.sum(1, Float64.abs(Num.subtract(left, right))))

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
    valueFromConfig(sample.trial.config, parameterName).pipe(
      Option.flatMap(finiteNumber),
      Option.map((observed) =>
        new WeightedCostSample({
          weight: numericSimilarity(candidateValue, observed),
          cost: sample.cost
        })
      )
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
    valueFromConfig(sample.trial.config, parameterName).pipe(
      Option.map((observed) =>
        new WeightedCostSample({
          weight: primitiveSimilarity(observed, candidateValue),
          cost: sample.cost
        })
      )
    ))

  return weightedMeanCost(weightedSamples).pipe(
    Option.orElse(() => meanCost(samples))
  )
}

const keySimilarity = (
  candidateValue: unknown,
  sampleValue: Option.Option<unknown>
): number => {
  const comparableSample = Option.flatMap(sampleValue, finiteNumber)

  return Option.all([finiteNumber(candidateValue), comparableSample]).pipe(
    Option.match({
      onNone: () =>
        Match.value(Option.exists(sampleValue, (value) => Equal.equals(candidateValue, value))).pipe(
          Match.when(true, () => 1),
          Match.orElse(() => BACKGROUND_SIMILARITY)
        ),
      onSome: ([candidateNumeric, sampleNumeric]) => numericSimilarity(candidateNumeric, sampleNumeric)
    })
  )
}

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
    const similarity = Match.value(Arr.isEmptyReadonlyArray(candidateEntries)).pipe(
      Match.when(true, () => 1),
      Match.orElse(() =>
        Num.unsafeDivide(
          Arr.reduce(candidateEntries, 0, (total, [key, candidateValue]) =>
            Num.sum(
              total,
              keySimilarity(
                candidateValue,
                valueFromConfig(sample.trial.config, key)
              )
            )),
          Arr.length(candidateEntries)
        )
      )
    )

    return new WeightedCostSample({
      weight: similarity,
      cost: sample.cost
    })
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

  return Match.value(Arr.isEmptyReadonlyArray(variances)).pipe(
    Match.when(true, () => Option.none()),
    Match.orElse(() =>
      Option.some(
        Num.unsafeDivide(
          Arr.reduce(variances, 0, (total, variance) => Num.sum(total, variance)),
          Arr.length(variances)
        )
      )
    )
  )
}
