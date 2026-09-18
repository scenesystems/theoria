/**
 * GEPA balanced merge subsampling — deterministic stratified selection across
 * comparison buckets.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { sampleStratifiedRoundRobin } from "@scenesystems/effect-search/Sampler"
import { Array as Arr, Chunk, HashMap, Match, Number as Num, Option } from "effect"
import type { MergeComparison, MergeComparisonBucket, MergeComparisons } from "../model.js"

type MergeBuckets = HashMap.HashMap<MergeComparisonBucket, Chunk.Chunk<MergeComparison>>

const MERGE_SUBSAMPLE_TARGET_SIZE = 5
const PARENT_A_BETTER: MergeComparisonBucket = "parent-a-better"
const PARENT_B_BETTER: MergeComparisonBucket = "parent-b-better"
const TIE: MergeComparisonBucket = "tie"

const emptyMergeBuckets: MergeBuckets = HashMap.fromIterable([
  [PARENT_A_BETTER, Chunk.empty<MergeComparison>()],
  [PARENT_B_BETTER, Chunk.empty<MergeComparison>()],
  [TIE, Chunk.empty<MergeComparison>()]
])

const bucketOrder = Chunk.make(PARENT_A_BETTER, PARENT_B_BETTER, TIE)

/**
 * Classify one merge comparison into parent-a-better / parent-b-better / tie buckets.
 *
 * @since 0.1.0
 * @category combinators
 */
export const classifyMergeComparisonBucket = (comparison: MergeComparison): MergeComparisonBucket =>
  Match.value(Num.subtract(comparison.parentAScore, comparison.parentBScore)).pipe(
    Match.when((delta) => delta > 0, () => PARENT_A_BETTER),
    Match.when((delta) => delta < 0, () => PARENT_B_BETTER),
    Match.orElse(() => TIE)
  )

const partitionMergeComparisons = (comparisons: MergeComparisons): MergeBuckets =>
  Arr.reduce(comparisons, emptyMergeBuckets, (buckets, comparison) => {
    const bucket = classifyMergeComparisonBucket(comparison)

    return HashMap.set(
      buckets,
      bucket,
      HashMap.get(buckets, bucket).pipe(
        Option.getOrElse(Chunk.empty<MergeComparison>),
        Chunk.append(comparison)
      )
    )
  })

/**
 * Select a deterministic balanced merge subsample (size 5 when available).
 *
 * Fallback policy: seeded shuffle each bucket, then round-robin while skipping empty buckets.
 *
 * @since 0.1.0
 * @category combinators
 */
export const selectBalancedMergeSubsample = (
  comparisons: MergeComparisons,
  seed: number
): MergeComparisons =>
  sampleStratifiedRoundRobin({
    buckets: partitionMergeComparisons(comparisons),
    bucketOrder,
    targetSize: Numeric.min(MERGE_SUBSAMPLE_TARGET_SIZE, Arr.length(comparisons)),
    seed
  }).pipe(Chunk.toReadonlyArray)
