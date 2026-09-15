import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean, Effect, Equal, Schema, String as Str } from "effect"

import * as Sampler from "../../src/Sampler/index.js"

const BucketSchema = Schema.Literal("parent-a-better", "parent-b-better", "tie")
type Bucket = typeof BucketSchema.Type

const PARENT_A_BETTER: Bucket = "parent-a-better"
const PARENT_B_BETTER: Bucket = "parent-b-better"
const TIE: Bucket = "tie"

const bucketOrder: Schema.Array$<typeof BucketSchema>["Type"] = Arr.make(PARENT_A_BETTER, PARENT_B_BETTER, TIE)

const mergeBuckets = {
  "parent-a-better": Arr.make("a-1", "a-2", "a-3"),
  "parent-b-better": Arr.make("b-1", "b-2"),
  tie: Arr.make("t-1")
}

describe("Sampler stratified utilities", () => {
  it.effect("samples deterministic round-robin subsets with seeded per-bucket shuffling", () =>
    Effect.sync(() => {
      const first = Sampler.sampleStratifiedRoundRobin({
        buckets: mergeBuckets,
        bucketOrder,
        targetSize: 5,
        seed: 42
      })
      const second = Sampler.sampleStratifiedRoundRobin({
        buckets: mergeBuckets,
        bucketOrder,
        targetSize: 5,
        seed: 42
      })
      const unique = Arr.reduce(
        first,
        Arr.empty<string>(),
        (acc, value) =>
          Boolean.match(Arr.some(acc, (seen) => Equal.equals(seen, value)), {
            onFalse: () => Arr.append(acc, value),
            onTrue: () => acc
          })
      )

      expect(second).toEqual(first)
      expect(Arr.length(first)).toBe(5)
      expect(Arr.length(unique)).toBe(Arr.length(first))
      expect(Arr.some(first, Str.startsWith("b-"))).toBe(true)
      expect(Arr.some(first, Str.startsWith("t-"))).toBe(true)
    }))

  it.effect("preserves bucket visitation order while skipping asymmetrically exhausted buckets", () =>
    Effect.sync(() => {
      const result = Sampler.sampleStratifiedRoundRobin({
        buckets: {
          "parent-a-better": Arr.make("a-1", "a-2", "a-3", "a-4"),
          "parent-b-better": Arr.make("b-1"),
          tie: Arr.make("t-1", "t-2")
        },
        bucketOrder: Arr.make(PARENT_B_BETTER, PARENT_A_BETTER, TIE),
        targetSize: 7,
        seed: 42
      })

      expect(result).toEqual(Arr.make("b-1", "a-4", "t-1", "a-2", "t-2", "a-3", "a-1"))
    }))

  it.effect("handles empty bucket orders and clamps oversized/negative target sizes", () =>
    Effect.sync(() => {
      const emptyOrder = Sampler.sampleStratifiedRoundRobin({
        buckets: mergeBuckets,
        bucketOrder: Arr.empty<Bucket>(),
        targetSize: 5,
        seed: 11
      })
      const negativeTarget = Sampler.sampleStratifiedRoundRobin({
        buckets: mergeBuckets,
        bucketOrder,
        targetSize: -1,
        seed: 11
      })
      const oversizedTarget = Sampler.sampleStratifiedRoundRobin({
        buckets: mergeBuckets,
        bucketOrder,
        targetSize: 99,
        seed: 11
      })

      expect(emptyOrder).toEqual([])
      expect(negativeTarget).toEqual([])
      expect(Arr.length(oversizedTarget)).toBe(6)
    }))
})
