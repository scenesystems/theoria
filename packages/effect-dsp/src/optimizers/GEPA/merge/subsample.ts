/**
 * GEPA balanced merge subsampling — deterministic stratified selection across
 * comparison buckets.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { sampleStratifiedRoundRobin } from "@scenesystems/effect-search/Sampler"
import { Array as Arr, Boolean as Bool, Match, Number as Num, Schema } from "effect"
import { type MergeComparison, type MergeComparisonBucket, MergeComparisons } from "../model.js"

class MergeBuckets extends Schema.Class<MergeBuckets>("GEPAMergeBuckets")({
  "parent-a-better": MergeComparisons,
  "parent-b-better": MergeComparisons,
  tie: MergeComparisons
}) {}

const MERGE_SUBSAMPLE_TARGET_SIZE = 5
const PARENT_A_BETTER: MergeComparisonBucket = "parent-a-better"
const PARENT_B_BETTER: MergeComparisonBucket = "parent-b-better"
const TIE: MergeComparisonBucket = "tie"

const emptyMergeBuckets = new MergeBuckets({
  [PARENT_A_BETTER]: Arr.empty<MergeComparison>(),
  [PARENT_B_BETTER]: Arr.empty<MergeComparison>(),
  [TIE]: Arr.empty<MergeComparison>()
})

const bucketOrder = Arr.make(PARENT_A_BETTER, PARENT_B_BETTER, TIE)
const isNonNaN = Schema.is(Schema.NonNaN)

/**
 * Classify one merge comparison into parent-a-better / parent-b-better / tie buckets.
 *
 * @since 0.1.0
 * @category combinators
 */
export const classifyMergeComparisonBucket = (comparison: MergeComparison): MergeComparisonBucket =>
  Bool.match(Bool.and(isNonNaN(comparison.parentAScore), isNonNaN(comparison.parentBScore)), {
    onFalse: () => TIE,
    onTrue: () =>
      Match.value(comparison.parentAScore).pipe(
        Match.when(Num.greaterThan(comparison.parentBScore), () => PARENT_A_BETTER),
        Match.when(Num.lessThan(comparison.parentBScore), () => PARENT_B_BETTER),
        Match.orElse(() => TIE)
      )
  })

const partitionMergeComparisons = (comparisons: MergeComparisons): MergeBuckets =>
  Arr.reduce(comparisons, emptyMergeBuckets, (buckets, comparison) => {
    const bucket = classifyMergeComparisonBucket(comparison)

    return Match.value(bucket).pipe(
      Match.when(PARENT_A_BETTER, () =>
        new MergeBuckets({
          [PARENT_A_BETTER]: Arr.append(buckets[PARENT_A_BETTER], comparison),
          [PARENT_B_BETTER]: buckets[PARENT_B_BETTER],
          [TIE]: buckets[TIE]
        })),
      Match.when(PARENT_B_BETTER, () =>
        new MergeBuckets({
          [PARENT_A_BETTER]: buckets[PARENT_A_BETTER],
          [PARENT_B_BETTER]: Arr.append(buckets[PARENT_B_BETTER], comparison),
          [TIE]: buckets[TIE]
        })),
      Match.when(TIE, () =>
        new MergeBuckets({
          [PARENT_A_BETTER]: buckets[PARENT_A_BETTER],
          [PARENT_B_BETTER]: buckets[PARENT_B_BETTER],
          [TIE]: Arr.append(buckets[TIE], comparison)
        })),
      Match.exhaustive
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
    targetSize: Num.min(MERGE_SUBSAMPLE_TARGET_SIZE, Arr.length(comparisons)),
    seed
  })
