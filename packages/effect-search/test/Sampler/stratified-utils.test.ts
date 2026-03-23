import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import * as Sampler from "../../src/Sampler/index.js"

type Bucket = "parent-a-better" | "parent-b-better" | "tie"

const PARENT_A_BETTER: Bucket = "parent-a-better"
const PARENT_B_BETTER: Bucket = "parent-b-better"
const TIE: Bucket = "tie"

const bucketOrder: ReadonlyArray<Bucket> = Arr.make(PARENT_A_BETTER, PARENT_B_BETTER, TIE)

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
          Arr.some(acc, (seen) => seen === value)
            ? acc
            : Arr.append(acc, value)
      )

      expect(second).toEqual(first)
      expect(first.length).toBe(5)
      expect(unique.length).toBe(first.length)
      expect(Arr.some(first, (entry) => entry.startsWith("b-"))).toBe(true)
      expect(Arr.some(first, (entry) => entry.startsWith("t-"))).toBe(true)
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
      expect(oversizedTarget.length).toBe(6)
    }))
})
