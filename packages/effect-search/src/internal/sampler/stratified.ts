/**
 * Reproducible round-robin selection from named buckets.
 *
 * @since 0.1.0
 */
import { isFinite, truncate } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Chunk, Data, HashMap, Match, Number as Num, Option } from "effect"

import type { StratifiedRoundRobinOptions } from "../../Sampler.js"
import { buildIndices, nextDeterministicSeed, normalizeDeterministicSeed, shuffleBySeed } from "./deterministic.js"

class SelectionState<Bucket, A> extends Data.Class<{
  readonly buckets: HashMap.HashMap<Bucket, Chunk.Chunk<A>>
  readonly selected: Chunk.Chunk<A>
  readonly cursor: number
}> {}

const normalizeTargetSize = (targetSize: number): number => {
  const finite = Match.value(isFinite(targetSize)).pipe(
    Match.when(true, () => truncate(targetSize)),
    Match.orElse(() => 0)
  )

  return Match.value(finite).pipe(
    Match.when(Num.lessThanOrEqualTo(0), () => 0),
    Match.orElse((count) => count)
  )
}

const bucketValues = <Bucket, A>(
  buckets: HashMap.HashMap<Bucket, Chunk.Chunk<A>>,
  bucket: Bucket
) => Option.getOrElse(HashMap.get(buckets, bucket), Chunk.empty<A>)

const availableCount = <Bucket, A>(
  buckets: HashMap.HashMap<Bucket, Chunk.Chunk<A>>,
  bucketOrderInput: Iterable<Bucket>
): number => {
  const bucketOrder = Arr.fromIterable(bucketOrderInput)
  return Arr.reduce(bucketOrder, 0, (total, bucket) => Num.sum(total, Chunk.size(bucketValues(buckets, bucket))))
}

const seedBuckets = <Bucket, A>(
  buckets: HashMap.HashMap<Bucket, Chunk.Chunk<A>>,
  bucketOrderInput: Iterable<Bucket>,
  seed: number
): HashMap.HashMap<Bucket, Chunk.Chunk<A>> => {
  const bucketOrder = Arr.fromIterable(bucketOrderInput)
  return Arr.reduce(
    bucketOrder,
    { seed: normalizeDeterministicSeed(seed), buckets },
    (state, bucket) => {
      const nextSeed = nextDeterministicSeed(state.seed)

      return {
        seed: nextSeed,
        buckets: HashMap.set(
          state.buckets,
          bucket,
          Chunk.fromIterable(shuffleBySeed(bucketValues(state.buckets, bucket), nextSeed))
        )
      }
    }
  ).buckets
}

const takeFromBucket = <Bucket, A>(
  state: SelectionState<Bucket, A>,
  bucket: Bucket
): SelectionState<Bucket, A> => {
  const values = bucketValues(state.buckets, bucket)
  const head = Chunk.head(values)

  return {
    buckets: HashMap.set(state.buckets, bucket, Chunk.drop(values, 1)),
    selected: Option.match(head, {
      onNone: () => state.selected,
      onSome: (value) => Chunk.append(state.selected, value)
    }),
    cursor: Num.increment(state.cursor)
  }
}

const roundRobinStepCount = (targetSize: number, bucketCount: number): number => Num.multiply(targetSize, bucketCount)

const selectRoundRobin = <Bucket, A>(
  initialState: SelectionState<Bucket, A>,
  bucketOrderInput: Iterable<Bucket>,
  targetSize: number
): SelectionState<Bucket, A> => {
  const bucketOrder = Arr.fromIterable(bucketOrderInput)
  return Arr.reduce(
    buildIndices(roundRobinStepCount(targetSize, Arr.length(bucketOrder))),
    initialState,
    (currentState) =>
      Match.value(
        Bool.or(
          Num.greaterThanOrEqualTo(Chunk.size(currentState.selected), targetSize),
          Num.lessThanOrEqualTo(availableCount(currentState.buckets, bucketOrder), 0)
        )
      ).pipe(
        Match.when(true, () => currentState),
        Match.orElse(() =>
          Option.match(
            Arr.get(bucketOrder, Num.remainder(currentState.cursor, Arr.length(bucketOrder))).pipe(
              Option.orElse(() => Arr.head(bucketOrder))
            ),
            {
              onNone: () => currentState,
              onSome: (bucket) => takeFromBucket(currentState, bucket)
            }
          )
        )
      )
  )
}

/**
 * Selects a seeded round-robin sequence from the ordered buckets.
 *
 * @remarks
 * Each named bucket is shuffled with a seed derived in `bucketOrder`, then one
 * value is taken per visit while empty buckets are skipped. The input arrays are
 * not modified. An empty order or non-positive target returns an empty array.
 * Non-finite targets are treated as zero.
 *
 * @typeParam Bucket - String union used for bucket keys and order entries.
 * @typeParam A - Value selected from each bucket.
 * @param options - Bucket contents, visible order, maximum result size, and seed.
 * @since 0.1.0
 * @category combinators
 */
export const sampleStratifiedRoundRobin = <Bucket, A>(
  options: StratifiedRoundRobinOptions<Bucket, A>
) => {
  const seededBuckets = seedBuckets(options.buckets, options.bucketOrder, options.seed)
  const targetSize = Num.min(
    normalizeTargetSize(options.targetSize),
    availableCount(seededBuckets, options.bucketOrder)
  )

  return Match.value(Bool.or(
    Num.lessThanOrEqualTo(Chunk.size(options.bucketOrder), 0),
    Num.lessThanOrEqualTo(targetSize, 0)
  )).pipe(
    Match.when(true, Chunk.empty<A>),
    Match.orElse(() =>
      selectRoundRobin(
        {
          buckets: seededBuckets,
          selected: Chunk.empty<A>(),
          cursor: 0
        },
        options.bucketOrder,
        targetSize
      ).selected
    )
  )
}
