/**
 * Reproducible selection among weighted numeric identifiers.
 *
 * @since 0.1.0
 */
import { Numeric } from "@scenesystems/effect-math"
import { Array as Arr, Boolean, Equal, Match, Number as Num, Option, Order, Schema, Tuple } from "effect"
import { PCGRandom } from "effect/Utils"

import { buildIndices, nextDeterministicSeed, normalizeDeterministicSeed } from "./deterministic.js"

/**
 * Decodes a numeric identifier and its relative selection weight.
 *
 * @remarks
 * The schema accepts fractional and non-finite numbers. Selection uses only
 * finite entries whose weight is greater than zero. Callers that need finite
 * integer identifiers must enforce that constraint before decoding.
 * @since 0.1.0
 * @category schemas
 */
export const WeightedIndexSchema = Schema.Struct({
  index: Schema.Number,
  weight: Schema.Number
})

/**
 * Associates the numeric value returned on selection with its relative weight.
 *
 * @remarks
 * Candidate entries are sorted by `index` before drawing. Positive weights need
 * not be normalized.
 * @since 0.1.0
 * @category models
 */
export type WeightedIndex = typeof WeightedIndexSchema.Type

/**
 * Decodes the fallback used when no candidate has positive weight.
 *
 * @remarks
 * `"lowest-index"` takes the first candidate after sorting by index.
 * `"seed-modulo"` maps the stepped seed to a position in that sorted array.
 * Both policies return `0` for an empty candidate array.
 * @since 0.1.0
 * @category schemas
 */
export const WeightedZeroWeightFallbackSchema = Schema.Literal("lowest-index", "seed-modulo")

/**
 * Chooses a deterministic result when all candidate weights are non-positive or invalid.
 * @since 0.1.0
 * @category models
 */
export type WeightedZeroWeightFallback = typeof WeightedZeroWeightFallbackSchema.Type

/**
 * Configures the result chosen when no positive weight is available.
 * @since 0.1.0
 * @category models
 */
export const SelectWeightedIndexOptions = Schema.Struct({
  /** Defaults to `"lowest-index"`. */
  zeroWeightFallback: Schema.optional(WeightedZeroWeightFallbackSchema)
})
export type SelectWeightedIndexOptions = typeof SelectWeightedIndexOptions.Type

/**
 * Configures repeated-index exclusion and zero-weight handling for a pair draw.
 * @since 0.1.0
 * @category models
 */
export const SampleWeightedPairOptions = Schema.Struct({
  /** Excludes every entry with the first selected index when another index exists. */
  distinct: Schema.optional(Schema.Boolean),
  /** Applies independently to each draw and defaults to `"lowest-index"`. */
  zeroWeightFallback: Schema.optional(WeightedZeroWeightFallbackSchema)
})
export type SampleWeightedPairOptions = typeof SampleWeightedPairOptions.Type

type WeightedIndices = Schema.Array$<typeof Schema.Number>["Type"]
type WeightedIndexArray = Schema.Array$<typeof WeightedIndexSchema>["Type"]
type CumulativeWeights = Schema.Array$<Schema.Tuple2<typeof Schema.Number, typeof Schema.Number>>["Type"]
type WeightedPair = Schema.Tuple2<typeof Schema.Number, typeof Schema.Number>["Type"]

const weightedIndexOrder: Order.Order<WeightedIndex> = Order.mapInput(
  Order.number,
  (entry) => entry.index
)

const sortedWeights = (weights: WeightedIndexArray): WeightedIndexArray => Arr.sort(weights, weightedIndexOrder)

const sortedPositiveWeights = (weights: WeightedIndexArray): WeightedIndexArray =>
  sortedWeights(
    Arr.filter(
      weights,
      (entry) => Boolean.and(Numeric.isFinite(entry.weight), Num.greaterThan(entry.weight, 0))
    )
  )

const normalizedPositiveWeights = (weights: WeightedIndexArray): WeightedIndexArray => {
  const positive = sortedPositiveWeights(weights)
  const maximumWeight = Arr.reduce(positive, 0, (maximum, entry) => Num.max(maximum, entry.weight))

  return Arr.map(positive, (entry) => ({
    index: entry.index,
    weight: Numeric.unsafeDivide(entry.weight, maximumWeight)
  }))
}

const cumulativeWeights = (weights: WeightedIndexArray): CumulativeWeights =>
  Arr.tailNonEmpty(
    Arr.scan(weights, Tuple.make(0, 0), (previous, weight) =>
      Tuple.make(weight.index, Num.sum(Tuple.getSecond(previous), weight.weight)))
  )

const fallbackIndex = (weights: WeightedIndexArray): number =>
  Arr.head(sortedWeights(weights)).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (entry) => entry.index
    })
  )

const fallbackSeedModuloIndex = (
  weights: WeightedIndexArray,
  seed: number
): number => {
  const sorted = sortedWeights(weights)
  const moduloCount = Num.max(1, Arr.length(sorted))
  const fallbackPosition = Num.remainder(normalizeDeterministicSeed(seed), moduloCount)

  return Arr.get(sorted, fallbackPosition).pipe(
    Option.match({
      onNone: () => fallbackIndex(weights),
      onSome: (entry) => entry.index
    })
  )
}

const defaultZeroWeightFallback = (): WeightedZeroWeightFallback => "lowest-index"

const zeroWeightFallbackFromNullable = (
  fallback?: WeightedZeroWeightFallback
): WeightedZeroWeightFallback =>
  Option.fromNullable(fallback).pipe(
    Option.getOrElse(defaultZeroWeightFallback)
  )

const fallbackIndexForPolicy = (
  weights: WeightedIndexArray,
  seed: number,
  zeroWeightFallback: WeightedZeroWeightFallback
): number =>
  Match.value(zeroWeightFallback).pipe(
    Match.when("seed-modulo", () => fallbackSeedModuloIndex(weights, seed)),
    Match.when("lowest-index", () => fallbackIndex(weights)),
    Match.exhaustive
  )

const selectWeightedIndexWithUnit = (
  weights: WeightedIndexArray,
  unit: number,
  fallbackSeed: number,
  zeroWeightFallback: WeightedZeroWeightFallback
): number => {
  const positive = normalizedPositiveWeights(weights)
  const cumulative = cumulativeWeights(positive)
  const totalWeight = Arr.last(cumulative).pipe(
    Option.match({
      onNone: () => 0,
      onSome: Tuple.getSecond
    })
  )

  return Boolean.match(Num.greaterThan(totalWeight, 0), {
    onFalse: () => fallbackIndexForPolicy(weights, fallbackSeed, zeroWeightFallback),
    onTrue: () => {
      const threshold = Num.multiply(unit, totalWeight)

      return Arr.findFirst(cumulative, (entry) => Num.lessThan(threshold, Tuple.getSecond(entry))).pipe(
        Option.match({
          onNone: () =>
            Arr.last(positive).pipe(Option.match({
              onNone: () => fallbackIndex(weights),
              onSome: (entry) => entry.index
            })),
          onSome: Tuple.getFirst
        })
      )
    }
  })
}

const normalizeDrawCount = (drawCount: number): number => {
  const finite = Boolean.match(Numeric.isFinite(drawCount), {
    onFalse: () => 0,
    onTrue: () => Numeric.truncate(drawCount)
  })

  return Boolean.match(Num.lessThan(finite, 0), {
    onFalse: () => finite,
    onTrue: () => 0
  })
}

/**
 * Selects one numeric identifier according to positive relative weights.
 *
 * @remarks
 * Candidate order does not affect the result because entries are sorted by
 * index. Non-positive and non-finite weights do not participate. Finite
 * positive weights are scaled by their maximum before summation, avoiding
 * overflow without changing their relative probabilities. If no valid positive
 * weight remains, the lowest sorted index is returned, or `0` when the input is
 * empty.
 *
 * @param weights - Candidate identifiers and relative weights; the array is not modified.
 * @param seed - Arbitrary numeric seed normalized before selection.
 * @since 0.1.0
 * @category combinators
 */
export const selectWeightedIndex = (
  weights: WeightedIndexArray,
  seed: number
): number => selectWeightedIndexWithPolicy(weights, seed)

/**
 * Selects one numeric identifier with configurable all-non-positive handling.
 *
 * @remarks
 * Positive-weight selection matches {@link selectWeightedIndex}. The fallback
 * option is consulted only when no finite positive cumulative weight is
 * available. The normalized seed initializes Effect's `PCGRandom`; the stepped
 * deterministic seed remains reserved for the fallback policy.
 *
 * @param weights - Candidate identifiers and relative weights; the array is not modified.
 * @param seed - Arbitrary numeric seed normalized before selection.
 * @param options - Uses `"lowest-index"` when omitted.
 * @since 0.1.0
 * @category combinators
 */
export const selectWeightedIndexWithPolicy = (
  weights: WeightedIndexArray,
  seed: number,
  options?: SelectWeightedIndexOptions
): number => {
  const zeroWeightFallback = zeroWeightFallbackFromNullable(options?.zeroWeightFallback)
  const normalizedSeed = normalizeDeterministicSeed(seed)
  const generator = new PCGRandom(normalizedSeed)

  return selectWeightedIndexWithUnit(
    weights,
    generator.number(),
    nextDeterministicSeed(normalizedSeed),
    zeroWeightFallback
  )
}

/**
 * Draws a reproducible sequence with replacement from positive relative weights.
 *
 * @remarks
 * A local Effect `PCGRandom` supplies one successive unit draw per result. This
 * corrects the former integer-remainder behavior, so seeded traces intentionally
 * differ from earlier releases. The count is truncated; non-finite and negative
 * counts produce an empty array. Each draw with no valid positive weight uses
 * the `"lowest-index"` fallback.
 *
 * @param weights - Candidate identifiers and relative weights; the array is not modified.
 * @param drawCount - Maximum number of returned identifiers after normalization.
 * @param seed - Arbitrary numeric seed used for the sequence.
 * @since 0.1.0
 * @category combinators
 */
export const sampleWeightedIndices = (
  weights: WeightedIndexArray,
  drawCount: number,
  seed: number
): WeightedIndices => {
  const normalizedSeed = normalizeDeterministicSeed(seed)
  const generator = new PCGRandom(normalizedSeed)

  return Tuple.getSecond(
    Arr.reduce(
      buildIndices(normalizeDrawCount(drawCount)),
      Tuple.make(normalizedSeed, Arr.empty<number>()),
      (state) => {
        const nextSeed = nextDeterministicSeed(Tuple.getFirst(state))

        return Tuple.make(
          nextSeed,
          Arr.append(
            Tuple.getSecond(state),
            selectWeightedIndexWithUnit(weights, generator.number(), nextSeed, defaultZeroWeightFallback())
          )
        )
      }
    )
  )
}

const weightsWithoutIndex = (
  weights: WeightedIndexArray,
  index: number
): WeightedIndexArray => {
  const filtered = Arr.filter(weights, (entry) => Boolean.not(Equal.equals(entry.index, index)))

  return Boolean.match(Num.lessThanOrEqualTo(Arr.length(filtered), 0), {
    onFalse: () => filtered,
    onTrue: () => weights
  })
}

/**
 * Draws two weighted identifiers from successive Effect `PCGRandom` values.
 *
 * @remarks
 * With `distinct: true`, the second draw excludes all candidates whose index
 * equals the first result. If no different index exists, it draws from the full
 * array again. An empty candidate array produces `[0, 0]`.
 *
 * @param weights - Candidate identifiers and relative weights; the array is not modified.
 * @param seed - Arbitrary numeric seed normalized before the first draw.
 * @param options - Repeated indices are allowed and `"lowest-index"` is used by default.
 * @since 0.1.0
 * @category combinators
 */
export const sampleWeightedPair = (
  weights: WeightedIndexArray,
  seed: number,
  options?: SampleWeightedPairOptions
): WeightedPair => {
  const zeroWeightFallback = zeroWeightFallbackFromNullable(options?.zeroWeightFallback)
  const distinct = Option.fromNullable(options?.distinct).pipe(Option.getOrElse(() => false))
  const normalizedSeed = normalizeDeterministicSeed(seed)
  const generator = new PCGRandom(normalizedSeed)
  const firstSeed = nextDeterministicSeed(normalizedSeed)
  const secondSeed = nextDeterministicSeed(firstSeed)
  const first = selectWeightedIndexWithUnit(weights, generator.number(), firstSeed, zeroWeightFallback)
  const secondWeights = Boolean.match(distinct, {
    onFalse: () => weights,
    onTrue: () => weightsWithoutIndex(weights, first)
  })
  const second = selectWeightedIndexWithUnit(secondWeights, generator.number(), secondSeed, zeroWeightFallback)

  return Tuple.make(first, second)
}
