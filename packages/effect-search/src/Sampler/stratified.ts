/**
 * Reproducible round-robin selection from named buckets.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Option, Record } from "effect"

import { buildIndices, nextDeterministicSeed, normalizeDeterministicSeed, shuffleBySeed } from "./deterministic.js"

type StratifiedBuckets<Bucket extends string, A> = Readonly<Record<Bucket, ReadonlyArray<A>>>

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
export type StratifiedRoundRobinOptions<Bucket extends string, A> = Readonly<{
  readonly buckets: StratifiedBuckets<Bucket, A>
  readonly bucketOrder: ReadonlyArray<Bucket>
  readonly targetSize: number
  readonly seed: number
}>

type SelectionState<Bucket extends string, A> = Readonly<{
  readonly buckets: StratifiedBuckets<Bucket, A>
  readonly selected: ReadonlyArray<A>
  readonly cursor: number
}>

const normalizeTargetSize = (targetSize: number): number => {
  const finite = Number.isFinite(targetSize)
    ? Math.trunc(targetSize)
    : 0

  return Match.value(finite).pipe(
    Match.when((count) => count <= 0, () => 0),
    Match.orElse((count) => count)
  )
}

const bucketValues = <Bucket extends string, A>(
  buckets: StratifiedBuckets<Bucket, A>,
  bucket: Bucket
): ReadonlyArray<A> => Option.getOrElse(Record.get(buckets, bucket), () => Arr.empty<A>())

const availableCount = <Bucket extends string, A>(
  buckets: StratifiedBuckets<Bucket, A>,
  bucketOrder: ReadonlyArray<Bucket>
): number => Arr.reduce(bucketOrder, 0, (total, bucket) => total + bucketValues(buckets, bucket).length)

const seedBuckets = <Bucket extends string, A>(
  buckets: StratifiedBuckets<Bucket, A>,
  bucketOrder: ReadonlyArray<Bucket>,
  seed: number
): StratifiedBuckets<Bucket, A> =>
  Arr.reduce(
    bucketOrder,
    { seed: normalizeDeterministicSeed(seed), buckets },
    (state, bucket) => {
      const nextSeed = nextDeterministicSeed(state.seed)

      return {
        seed: nextSeed,
        buckets: Record.set(state.buckets, bucket, shuffleBySeed(bucketValues(state.buckets, bucket), nextSeed))
      }
    }
  ).buckets

const takeFromBucket = <Bucket extends string, A>(
  state: SelectionState<Bucket, A>,
  bucket: Bucket
): SelectionState<Bucket, A> => {
  const values = bucketValues(state.buckets, bucket)
  const head = Arr.head(values)

  return {
    buckets: Record.set(state.buckets, bucket, Arr.drop(values, 1)),
    selected: Option.match(head, {
      onNone: () => state.selected,
      onSome: (value) => Arr.append(state.selected, value)
    }),
    cursor: state.cursor + 1
  }
}

const roundRobinStepCount = (targetSize: number, bucketCount: number): number => targetSize * bucketCount

const selectRoundRobin = <Bucket extends string, A>(
  initialState: SelectionState<Bucket, A>,
  bucketOrder: ReadonlyArray<Bucket>,
  targetSize: number
): SelectionState<Bucket, A> =>
  Arr.reduce(
    buildIndices(roundRobinStepCount(targetSize, bucketOrder.length)),
    initialState,
    (currentState) =>
      Match.value(
        currentState.selected.length >= targetSize ||
          availableCount(currentState.buckets, bucketOrder) <= 0
      ).pipe(
        Match.when(true, () => currentState),
        Match.orElse(() =>
          Option.match(
            Arr.get(bucketOrder, currentState.cursor % bucketOrder.length).pipe(
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
): ReadonlyArray<A> => {
  const seededBuckets = seedBuckets(options.buckets, options.bucketOrder, options.seed)
  const targetSize = Math.min(
    normalizeTargetSize(options.targetSize),
    availableCount(seededBuckets, options.bucketOrder)
  )

  return Match.value(options.bucketOrder.length <= 0 || targetSize <= 0).pipe(
    Match.when(true, () => Arr.empty<A>()),
    Match.orElse(() =>
      selectRoundRobin(
        {
          buckets: seededBuckets,
          selected: Arr.empty<A>(),
          cursor: 0
        },
        options.bucketOrder,
        targetSize
      ).selected
    )
  )
}
