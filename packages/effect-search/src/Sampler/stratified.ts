/**
 * Reproducible round-robin selection from named buckets.
 *
 * @since 0.1.0
 */
import { Numeric } from "@scenesystems/effect-math"
import { Array as Arr, Boolean, Data, Number as Num, Option, Record, Tuple } from "effect"
import type { Schema } from "effect"

import { buildIndices, nextDeterministicSeed, normalizeDeterministicSeed, shuffleBySeed } from "./deterministic.js"

type ImmutableArray<A> = Schema.Array$<Schema.Schema<A>>["Type"]
type StratifiedBuckets<Bucket extends string, A> = Schema.Record$<
  Schema.Schema<Bucket>,
  Schema.Array$<Schema.Schema<A>>
>["Type"]
type SelectionState<Bucket extends string, A> = Schema.Tuple<[
  Schema.Schema<StratifiedBuckets<Bucket, A>>,
  Schema.Array$<Schema.Schema<A>>,
  typeof Schema.Number
]>["Type"]

/**
 * Describes the buckets visible to a stratified draw and their visitation order.
 *
 * @remarks
 * Only names in `bucketOrder` participate. Repeating a name gives that bucket
 * additional turns. `targetSize` is truncated and capped by the entries visible
 * through that order.
 *
 * @typeParam Bucket - String union used for bucket keys and order entries.
 * @typeParam A - Value selected from each bucket.
 * @since 0.1.0
 * @category models
 */
export class StratifiedRoundRobinOptions<Bucket extends string, A> extends Data.Class<{
  readonly buckets: StratifiedBuckets<Bucket, A>
  readonly bucketOrder: ImmutableArray<Bucket>
  readonly targetSize: number
  readonly seed: number
}> {}

const normalizeTargetSize = (targetSize: number): number => {
  const finite = Boolean.match(Numeric.isFinite(targetSize), {
    onFalse: () => 0,
    onTrue: () => Numeric.truncate(targetSize)
  })

  return Boolean.match(Num.lessThanOrEqualTo(finite, 0), {
    onFalse: () => finite,
    onTrue: () => 0
  })
}

const bucketValues = <Bucket extends string, A>(
  buckets: StratifiedBuckets<Bucket, A>,
  bucket: Bucket
): ImmutableArray<A> => Option.getOrElse(Record.get(buckets, bucket), () => Arr.empty<A>())

const availableCount = <Bucket extends string, A>(
  buckets: StratifiedBuckets<Bucket, A>,
  bucketOrder: ImmutableArray<Bucket>
): number => Arr.reduce(bucketOrder, 0, (total, bucket) => Num.sum(total, Arr.length(bucketValues(buckets, bucket))))

const seedBuckets = <Bucket extends string, A>(
  buckets: StratifiedBuckets<Bucket, A>,
  bucketOrder: ImmutableArray<Bucket>,
  seed: number
): StratifiedBuckets<Bucket, A> =>
  Tuple.getSecond(
    Arr.reduce(
      bucketOrder,
      Tuple.make(normalizeDeterministicSeed(seed), buckets),
      (state, bucket) => {
        const nextSeed = nextDeterministicSeed(Tuple.getFirst(state))

        return Tuple.make(
          nextSeed,
          Record.set(
            Tuple.getSecond(state),
            bucket,
            shuffleBySeed(bucketValues(Tuple.getSecond(state), bucket), nextSeed)
          )
        )
      }
    )
  )

const takeFromBucket = <Bucket extends string, A>(
  state: SelectionState<Bucket, A>,
  bucket: Bucket
): SelectionState<Bucket, A> => {
  const [buckets, selected, cursor] = state
  const values = bucketValues(buckets, bucket)
  const head = Arr.head(values)

  return Tuple.make(
    Record.set(buckets, bucket, Arr.drop(values, 1)),
    Option.match(head, {
      onNone: () => selected,
      onSome: (value) => Arr.append(selected, value)
    }),
    Num.increment(cursor)
  )
}

const roundRobinStepCount = (targetSize: number, bucketCount: number): number => Num.multiply(targetSize, bucketCount)

const selectRoundRobin = <Bucket extends string, A>(
  initialState: SelectionState<Bucket, A>,
  bucketOrder: ImmutableArray<Bucket>,
  targetSize: number
): SelectionState<Bucket, A> =>
  Arr.reduce(
    buildIndices(roundRobinStepCount(targetSize, Arr.length(bucketOrder))),
    initialState,
    (currentState) => {
      const [buckets, selected, cursor] = currentState

      return Boolean.match(
        Boolean.or(
          Num.greaterThanOrEqualTo(Arr.length(selected), targetSize),
          Num.lessThanOrEqualTo(availableCount(buckets, bucketOrder), 0)
        ),
        {
          onFalse: () =>
            Option.match(
              Arr.get(bucketOrder, Num.remainder(cursor, Arr.length(bucketOrder))).pipe(
                Option.orElse(() => Arr.head(bucketOrder))
              ),
              {
                onNone: () => currentState,
                onSome: (bucket) => takeFromBucket(currentState, bucket)
              }
            ),
          onTrue: () => currentState
        }
      )
    }
  )

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
export const sampleStratifiedRoundRobin = <Bucket extends string, A>(
  options: StratifiedRoundRobinOptions<Bucket, A>
): ImmutableArray<A> => {
  const seededBuckets = seedBuckets(options.buckets, options.bucketOrder, options.seed)
  const targetSize = Num.min(
    normalizeTargetSize(options.targetSize),
    availableCount(seededBuckets, options.bucketOrder)
  )

  return Boolean.match(
    Boolean.or(
      Num.lessThanOrEqualTo(Arr.length(options.bucketOrder), 0),
      Num.lessThanOrEqualTo(targetSize, 0)
    ),
    {
      onFalse: () => {
        const [, selected] = selectRoundRobin(
          Tuple.make(seededBuckets, Arr.empty<A>(), 0),
          options.bucketOrder,
          targetSize
        )
        return selected
      },
      onTrue: () => Arr.empty<A>()
    }
  )
}
