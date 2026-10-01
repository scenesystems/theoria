/**
 * Reproducible selection among weighted numeric identifiers.
 *
 * @since 0.1.0
 */
import { isFinite, truncate, unsafeDivide } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Equal, Match, Number as Num, Option, Order, Tuple } from "effect"
import { PCGRandom } from "effect/Utils"

import type { Vector } from "../../Objective.js"

import type {
  SampleWeightedPairOptions,
  SelectWeightedIndexOptions,
  WeightedIndex,
  WeightedZeroWeightFallback
} from "../../Sampler.js"
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
/**
 * Configures the result chosen when no positive weight is available.
 * @since 0.1.0
 * @category models
 */
/**
 * Configures repeated-index exclusion and zero-weight handling for a pair draw.
 * @since 0.1.0
 * @category models
 */
class WeightedSamplingState extends Data.Class<{
  readonly seed: number
  readonly indices: Vector
}> {}

const weightedIndexOrder: Order.Order<WeightedIndex> = Order.mapInput(
  Order.number,
  (entry) => entry.index
)

const sortedWeights = (weightsInput: Iterable<WeightedIndex>) => {
  const weights = Arr.fromIterable(weightsInput)
  return Arr.sort(weights, weightedIndexOrder)
}

const sortedPositiveWeights = (weightsInput: Iterable<WeightedIndex>) => {
  const weights = Arr.fromIterable(weightsInput)
  return sortedWeights(
    Arr.filter(weights, (entry) => Bool.and(isFinite(entry.weight), Num.greaterThan(entry.weight, 0)))
  )
}

const normalizedPositiveWeights = (weightsInput: Iterable<WeightedIndex>) => {
  const weights = Arr.fromIterable(weightsInput)
  const positive = sortedPositiveWeights(weights)
  const maximumWeight = Arr.reduce(positive, 0, (maximum, entry) => Num.max(maximum, entry.weight))

  return Arr.map(positive, (entry) => ({
    index: entry.index,
    weight: unsafeDivide(entry.weight, maximumWeight)
  }))
}

const cumulativeWeights = (weightsInput: Iterable<WeightedIndex>) => {
  const weights = Arr.fromIterable(weightsInput)
  return Arr.tailNonEmpty(
    Arr.scan(
      weights,
      Tuple.make(0, 0),
      (previous, weight) => Tuple.make(weight.index, Num.sum(Tuple.getSecond(previous), weight.weight))
    )
  )
}

const fallbackIndex = (weightsInput: Iterable<WeightedIndex>): number => {
  const weights = Arr.fromIterable(weightsInput)
  return Arr.head(sortedWeights(weights)).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (entry) => entry.index
    })
  )
}

const fallbackSeedModuloIndex = (
  weightsInput: Iterable<WeightedIndex>,
  seed: number
): number => {
  const weights = Arr.fromIterable(weightsInput)

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
  weightsInput: Iterable<WeightedIndex>,
  seed: number,
  zeroWeightFallback: WeightedZeroWeightFallback
): number => {
  const weights = Arr.fromIterable(weightsInput)
  return Match.value(zeroWeightFallback).pipe(
    Match.when("seed-modulo", () => fallbackSeedModuloIndex(weights, seed)),
    Match.orElse(() => fallbackIndex(weights))
  )
}

const selectWeightedIndexWithUnit = (
  weightsInput: Iterable<WeightedIndex>,
  unit: number,
  fallbackSeed: number,
  zeroWeightFallback: WeightedZeroWeightFallback
): number => {
  const weights = Arr.fromIterable(weightsInput)

  const positive = normalizedPositiveWeights(weights)
  const cumulative = cumulativeWeights(positive)
  const totalWeight = Arr.last(cumulative).pipe(
    Option.match({
      onNone: () => 0,
      onSome: Tuple.getSecond
    })
  )

  return Match.value(Num.greaterThan(totalWeight, 0)).pipe(
    Match.when(false, () => fallbackIndexForPolicy(weights, fallbackSeed, zeroWeightFallback)),
    Match.when(true, () => {
      const threshold = Num.multiply(unit, totalWeight)

      return Arr.findFirst(cumulative, (entry) => Num.lessThan(threshold, Tuple.getSecond(entry))).pipe(
        Option.match({
          onNone: () =>
            Arr.last(positive).pipe(
              Option.match({
                onNone: () => fallbackIndex(weights),
                onSome: (entry) => entry.index
              })
            ),
          onSome: Tuple.getFirst
        })
      )
    }),
    Match.exhaustive
  )
}

const normalizeDrawCount = (drawCount: number): number => {
  const finite = Match.value(isFinite(drawCount)).pipe(
    Match.when(true, () => truncate(drawCount)),
    Match.orElse(() => 0)
  )

  return Match.value(finite).pipe(
    Match.when(Num.lessThan(0), () => 0),
    Match.orElse((count) => count)
  )
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
  weightsInput: Iterable<WeightedIndex>,
  seed: number
): number => {
  const weights = Arr.fromIterable(weightsInput)
  return selectWeightedIndexWithPolicy(weights, seed)
}

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
  weightsInput: Iterable<WeightedIndex>,
  seed: number,
  options?: SelectWeightedIndexOptions
): number => {
  const weights = Arr.fromIterable(weightsInput)

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
  weightsInput: Iterable<WeightedIndex>,
  drawCount: number,
  seed: number
) => {
  const weights = Arr.fromIterable(weightsInput)
  const normalizedSeed = normalizeDeterministicSeed(seed)
  const generator = new PCGRandom(normalizedSeed)
  return Arr.reduce(
    buildIndices(normalizeDrawCount(drawCount)),
    new WeightedSamplingState({
      seed: normalizedSeed,
      indices: Arr.empty<number>()
    }),
    (state) => {
      const nextSeed = nextDeterministicSeed(state.seed)

      return new WeightedSamplingState({
        seed: nextSeed,
        indices: Arr.append(
          state.indices,
          selectWeightedIndexWithUnit(weights, generator.number(), nextSeed, defaultZeroWeightFallback())
        )
      })
    }
  ).indices
}

const weightsWithoutIndex = (
  weightsInput: Iterable<WeightedIndex>,
  index: number
) => {
  const weights = Arr.fromIterable(weightsInput)

  const filtered = Arr.filter(weights, (entry) => Bool.not(Equal.equals(entry.index, index)))

  return Match.value(Num.lessThanOrEqualTo(Arr.length(filtered), 0)).pipe(
    Match.when(true, () => weights),
    Match.orElse(() => filtered)
  )
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
  weightsInput: Iterable<WeightedIndex>,
  seed: number,
  options?: SampleWeightedPairOptions
): readonly [number, number] => {
  const weights = Arr.fromIterable(weightsInput)

  const zeroWeightFallback = zeroWeightFallbackFromNullable(options?.zeroWeightFallback)
  const distinct = Option.fromNullable(options?.distinct).pipe(Option.getOrElse(() => false))
  const normalizedSeed = normalizeDeterministicSeed(seed)
  const generator = new PCGRandom(normalizedSeed)
  const firstSeed = nextDeterministicSeed(normalizedSeed)
  const secondSeed = nextDeterministicSeed(firstSeed)
  const first = selectWeightedIndexWithUnit(weights, generator.number(), firstSeed, zeroWeightFallback)
  const secondWeights = Match.value(distinct).pipe(
    Match.when(true, () => weightsWithoutIndex(weights, first)),
    Match.orElse(() => weights)
  )
  const second = selectWeightedIndexWithUnit(secondWeights, generator.number(), secondSeed, zeroWeightFallback)

  return Data.tuple(first, second)
}
