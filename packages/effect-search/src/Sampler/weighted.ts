/**
 * Reproducible selection among weighted numeric identifiers.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Option, Order, Schema } from "effect"

import { buildIndices, nextDeterministicSeed, normalizeDeterministicSeed } from "./deterministic.js"

/**
 * Decodes a numeric identifier and its relative selection weight.
 *
 * @remarks
 * The schema accepts fractional and non-finite numbers. Selection uses only
 * entries whose weight is greater than zero, so callers that need finite
 * integer identifiers or finite weights must enforce those constraints before
 * decoding.
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
export type SelectWeightedIndexOptions = Readonly<{
  /** Defaults to `"lowest-index"`. */
  readonly zeroWeightFallback?: WeightedZeroWeightFallback
}>

/**
 * Configures repeated-index exclusion and zero-weight handling for a pair draw.
 * @since 0.1.0
 * @category models
 */
export type SampleWeightedPairOptions = Readonly<{
  /** Excludes every entry with the first selected index when another index exists. */
  readonly distinct?: boolean
  /** Applies independently to each draw and defaults to `"lowest-index"`. */
  readonly zeroWeightFallback?: WeightedZeroWeightFallback
}>

class CumulativeWeight extends Data.Class<{
  readonly index: number
  readonly cumulativeWeight: number
}> {}

class WeightedSamplingState extends Data.Class<{
  readonly seed: number
  readonly indices: ReadonlyArray<number>
}> {}

const weightedIndexOrder: Order.Order<WeightedIndex> = Order.mapInput(
  Order.number,
  (entry) => entry.index
)

const sortedWeights = (weights: ReadonlyArray<WeightedIndex>): ReadonlyArray<WeightedIndex> =>
  Arr.sort(weights, weightedIndexOrder)

const sortedPositiveWeights = (weights: ReadonlyArray<WeightedIndex>): ReadonlyArray<WeightedIndex> =>
  sortedWeights(Arr.filter(weights, (entry) => entry.weight > 0))

const cumulativeWeights = (weights: ReadonlyArray<WeightedIndex>): ReadonlyArray<CumulativeWeight> =>
  Arr.reduce(weights, Arr.empty<CumulativeWeight>(), (acc, weight) => {
    const previous = Arr.last(acc).pipe(
      Option.match({
        onNone: () => 0,
        onSome: (entry) => entry.cumulativeWeight
      })
    )

    return Arr.append(
      acc,
      new CumulativeWeight({
        index: weight.index,
        cumulativeWeight: previous + weight.weight
      })
    )
  })

const fallbackIndex = (weights: ReadonlyArray<WeightedIndex>): number =>
  Arr.head(sortedWeights(weights)).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (entry) => entry.index
    })
  )

const fallbackSeedModuloIndex = (
  weights: ReadonlyArray<WeightedIndex>,
  seed: number
): number => {
  const sorted = sortedWeights(weights)
  const moduloCount = Math.max(1, sorted.length)
  const fallbackPosition = normalizeDeterministicSeed(seed) % moduloCount

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
  weights: ReadonlyArray<WeightedIndex>,
  seed: number,
  zeroWeightFallback: WeightedZeroWeightFallback
): number =>
  Match.value(zeroWeightFallback).pipe(
    Match.when("seed-modulo", () => fallbackSeedModuloIndex(weights, seed)),
    Match.orElse(() => fallbackIndex(weights))
  )

const selectWeightedIndexWithSeed = (
  weights: ReadonlyArray<WeightedIndex>,
  seed: number,
  zeroWeightFallback: WeightedZeroWeightFallback
): number => {
  const positive = sortedPositiveWeights(weights)
  const cumulative = cumulativeWeights(positive)
  const totalWeight = Arr.last(cumulative).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (entry) => entry.cumulativeWeight
    })
  )

  return Match.value(totalWeight > 0).pipe(
    Match.when(false, () => fallbackIndexForPolicy(weights, seed, zeroWeightFallback)),
    Match.when(true, () => {
      const roll = seed % totalWeight

      return Arr.findFirst(cumulative, (entry) => roll < entry.cumulativeWeight).pipe(
        Option.match({
          onNone: () => fallbackIndex(weights),
          onSome: (entry) => entry.index
        })
      )
    }),
    Match.exhaustive
  )
}

const normalizeDrawCount = (drawCount: number): number => {
  const finite = Number.isFinite(drawCount)
    ? Math.trunc(drawCount)
    : 0

  return Match.value(finite).pipe(
    Match.when((count) => count < 0, () => 0),
    Match.orElse((count) => count)
  )
}

/**
 * Selects one numeric identifier according to positive relative weights.
 *
 * @remarks
 * The normalized seed is stepped once. Candidate order does not affect the
 * result because entries are sorted by index. Non-positive and `NaN` weights do
 * not participate. If no positive weight remains, the lowest sorted index is
 * returned, or `0` when the input is empty.
 *
 * @param weights - Candidate identifiers and relative weights; the array is not modified.
 * @param seed - Arbitrary numeric seed normalized before selection.
 * @since 0.1.0
 * @category combinators
 */
export const selectWeightedIndex = (
  weights: ReadonlyArray<WeightedIndex>,
  seed: number
): number => selectWeightedIndexWithPolicy(weights, seed)

/**
 * Selects one numeric identifier with configurable all-non-positive handling.
 *
 * @remarks
 * Positive-weight selection matches {@link selectWeightedIndex}. The fallback
 * option is consulted only when no positive cumulative weight is available.
 *
 * @param weights - Candidate identifiers and relative weights; the array is not modified.
 * @param seed - Arbitrary numeric seed normalized and stepped before selection.
 * @param options - Uses `"lowest-index"` when omitted.
 * @since 0.1.0
 * @category combinators
 */
export const selectWeightedIndexWithPolicy = (
  weights: ReadonlyArray<WeightedIndex>,
  seed: number,
  options?: SelectWeightedIndexOptions
): number => {
  const zeroWeightFallback = zeroWeightFallbackFromNullable(options?.zeroWeightFallback)

  return selectWeightedIndexWithSeed(
    weights,
    nextDeterministicSeed(normalizeDeterministicSeed(seed)),
    zeroWeightFallback
  )
}

/**
 * Draws a reproducible sequence with replacement from positive relative weights.
 *
 * @remarks
 * The normalized seed advances once per draw. The count is truncated;
 * non-finite and negative counts produce an empty array. Each all-non-positive
 * draw uses the `"lowest-index"` fallback.
 *
 * @param weights - Candidate identifiers and relative weights; the array is not modified.
 * @param drawCount - Maximum number of returned identifiers after normalization.
 * @param seed - Arbitrary numeric seed used for the sequence.
 * @since 0.1.0
 * @category combinators
 */
export const sampleWeightedIndices = (
  weights: ReadonlyArray<WeightedIndex>,
  drawCount: number,
  seed: number
): ReadonlyArray<number> =>
  Arr.reduce(
    buildIndices(normalizeDrawCount(drawCount)),
    new WeightedSamplingState({
      seed: normalizeDeterministicSeed(seed),
      indices: Arr.empty<number>()
    }),
    (state) => {
      const nextSeed = nextDeterministicSeed(state.seed)

      return new WeightedSamplingState({
        seed: nextSeed,
        indices: Arr.append(state.indices, selectWeightedIndexWithSeed(weights, nextSeed, defaultZeroWeightFallback()))
      })
    }
  ).indices

const weightsWithoutIndex = (
  weights: ReadonlyArray<WeightedIndex>,
  index: number
): ReadonlyArray<WeightedIndex> => {
  const filtered = Arr.filter(weights, (entry) => entry.index !== index)

  return filtered.length <= 0
    ? weights
    : filtered
}

/**
 * Draws two weighted identifiers from consecutive deterministic seed steps.
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
  weights: ReadonlyArray<WeightedIndex>,
  seed: number,
  options?: SampleWeightedPairOptions
): readonly [number, number] => {
  const zeroWeightFallback = zeroWeightFallbackFromNullable(options?.zeroWeightFallback)
  const distinct = Option.fromNullable(options?.distinct).pipe(Option.getOrElse(() => false))
  const firstSeed = nextDeterministicSeed(normalizeDeterministicSeed(seed))
  const secondSeed = nextDeterministicSeed(firstSeed)
  const first = selectWeightedIndexWithSeed(weights, firstSeed, zeroWeightFallback)
  const secondWeights = Match.value(distinct).pipe(
    Match.when(true, () => weightsWithoutIndex(weights, first)),
    Match.orElse(() => weights)
  )
  const second = selectWeightedIndexWithSeed(secondWeights, secondSeed, zeroWeightFallback)

  return Data.tuple(first, second)
}
