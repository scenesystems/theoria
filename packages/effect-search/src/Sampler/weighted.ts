/**
 * Deterministic weighted-index sampling helpers.
 *
 * Decomposition rationale: weighted single-draw selection, deterministic replay sampling,
 * and pair sampling share one seed-stepping kernel and fallback policy contract, so they
 * remain co-located for auditability.
 *
 * Follow-up decomposition plan: extract zero-weight fallback policy helpers into
 * `Sampler/weightedFallback.ts` and pair-specific orchestration into
 * `Sampler/weightedPair.ts` once sampler API stabilization work lands.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Option, Order, Schema } from "effect"

import { buildIndices, nextDeterministicSeed, normalizeDeterministicSeed } from "./deterministic.js"

/**
 * Schema for a candidate entry pairing an integer index with a numeric weight.
 * Weights do not need to sum to 1 — they are treated as relative magnitudes
 * during cumulative-distribution selection.
 *
 * @see {@link WeightedIndex} for the inferred type
 * @see {@link selectWeightedIndex} consumes arrays of this shape
 * @since 0.1.0
 * @category schemas
 */
export const WeightedIndexSchema = Schema.Struct({
  index: Schema.Number,
  weight: Schema.Number
})

/**
 * Inferred type of a decoded {@link WeightedIndexSchema} value.
 *
 * @see {@link WeightedIndexSchema} for the runtime schema
 * @since 0.1.0
 * @category models
 */
export type WeightedIndex = typeof WeightedIndexSchema.Type

/**
 * Schema for the zero-weight fallback strategy.
 * `"lowest-index"` always returns the smallest index in the candidate array.
 * `"seed-modulo"` hashes the current seed into the candidate array, providing
 * deterministic but distributed fallback selection across candidates.
 *
 * @see {@link WeightedZeroWeightFallback} for the inferred type
 * @see {@link selectWeightedIndexWithPolicy} applies this fallback
 * @since 0.1.0
 * @category schemas
 */
export const WeightedZeroWeightFallbackSchema = Schema.Literal("lowest-index", "seed-modulo")

/**
 * Inferred type of a decoded {@link WeightedZeroWeightFallbackSchema} value.
 *
 * @see {@link WeightedZeroWeightFallbackSchema} for the runtime schema
 * @see {@link SelectWeightedIndexOptions} where this type is consumed
 * @since 0.1.0
 * @category models
 */
export type WeightedZeroWeightFallback = typeof WeightedZeroWeightFallbackSchema.Type

/**
 * Controls for single-index weighted selection. When `zeroWeightFallback`
 * is omitted, `"lowest-index"` is used as the default policy.
 *
 * @see {@link selectWeightedIndexWithPolicy} accepts these options
 * @see {@link WeightedZeroWeightFallback} for the available fallback strategies
 * @since 0.1.0
 * @category models
 */
export type SelectWeightedIndexOptions = Readonly<{
  readonly zeroWeightFallback?: WeightedZeroWeightFallback
}>

/**
 * Controls for paired weighted selection. When `distinct` is true, the second
 * index is drawn from a candidate set that excludes the first selected index,
 * guaranteeing the pair contains two different values (unless only one
 * candidate exists). Defaults to `false`.
 *
 * @see {@link sampleWeightedPair} accepts these options
 * @see {@link WeightedZeroWeightFallback} for the available fallback strategies
 * @since 0.1.0
 * @category models
 */
export type SampleWeightedPairOptions = Readonly<{
  readonly distinct?: boolean
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
 * Select one index from weighted candidates using seeded determinism and the
 * default `"lowest-index"` zero-weight fallback. Prefer this over
 * {@link selectWeightedIndexWithPolicy} when the caller does not need to
 * control fallback behavior.
 *
 * @see {@link selectWeightedIndexWithPolicy} for explicit fallback control
 * @see {@link sampleWeightedIndices} for drawing multiple indices
 * @since 0.1.0
 * @category combinators
 */
export const selectWeightedIndex = (
  weights: ReadonlyArray<WeightedIndex>,
  seed: number
): number => selectWeightedIndexWithPolicy(weights, seed)

/**
 * Select one index from weighted candidates with an explicit zero-weight
 * fallback policy. Use this instead of {@link selectWeightedIndex} when the
 * caller needs `"seed-modulo"` fallback to distribute zero-weight selections
 * across candidates rather than always returning the lowest index.
 *
 * @see {@link selectWeightedIndex} simpler variant with default fallback
 * @see {@link WeightedZeroWeightFallback} for the available fallback strategies
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
 * Draw `drawCount` weighted indices using seeded determinism. Each draw
 * advances the LCG seed, making the full sequence reproducible for replay
 * and distribution-uniformity checks. Always uses the `"lowest-index"`
 * fallback policy for zero-weight candidates.
 *
 * @see {@link selectWeightedIndex} single-draw variant
 * @see {@link sampleWeightedPair} for correlated two-draw sampling
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
 * Draw a correlated pair of weighted indices from two consecutive LCG steps.
 * When `distinct` is true the second draw excludes the first selected index,
 * preventing same-index pairs (falls back to the full candidate set when only
 * one candidate exists). Returns a structurally-equal `Data.tuple`.
 *
 * @see {@link SampleWeightedPairOptions} for the `distinct` and fallback controls
 * @see {@link selectWeightedIndexWithPolicy} underlying single-draw primitive
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
