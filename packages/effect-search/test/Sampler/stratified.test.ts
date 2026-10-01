import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Equal, HashMap, Match, Number as Num, String as Str, Tuple } from "effect"

import * as Sampler from "../../src/Sampler.js"

type Bucket = "parent-a-better" | "parent-b-better" | "tie"

const PARENT_A_BETTER: Bucket = "parent-a-better"
const PARENT_B_BETTER: Bucket = "parent-b-better"
const TIE: Bucket = "tie"

const bucketOrder = Chunk.make(PARENT_A_BETTER, PARENT_B_BETTER, TIE)

const mergeBuckets = HashMap.make(
  Tuple.make(PARENT_A_BETTER, Chunk.make("a-1", "a-2", "a-3")),
  Tuple.make(PARENT_B_BETTER, Chunk.make("b-1", "b-2")),
  Tuple.make(TIE, Chunk.make("t-1"))
)

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
          Match.value(Arr.some(acc, (seen) => Equal.equals(seen, value))).pipe(
            Match.when(true, () => acc),
            Match.orElse(() => Arr.append(acc, value))
          )
      )

      expect(second).toEqual(first)
      expect(Chunk.size(first)).toBe(5)
      expect(Arr.length(unique)).toBe(Chunk.size(first))
      expect(Chunk.some(first, Str.startsWith("b-"))).toBe(true)
      expect(Chunk.some(first, Str.startsWith("t-"))).toBe(true)
    }))

  it.effect("handles empty bucket orders and clamps oversized/negative target sizes", () =>
    Effect.sync(() => {
      const emptyOrder = Sampler.sampleStratifiedRoundRobin({
        buckets: mergeBuckets,
        bucketOrder: Chunk.empty<Bucket>(),
        targetSize: 5,
        seed: 11
      })
      const negativeTarget = Sampler.sampleStratifiedRoundRobin({
        buckets: mergeBuckets,
        bucketOrder,
        targetSize: Num.negate(1),
        seed: 11
      })
      const oversizedTarget = Sampler.sampleStratifiedRoundRobin({
        buckets: mergeBuckets,
        bucketOrder,
        targetSize: 99,
        seed: 11
      })

      expect(Chunk.isEmpty(emptyOrder)).toBe(true)
      expect(Chunk.isEmpty(negativeTarget)).toBe(true)
      expect(Chunk.size(oversizedTarget)).toBe(6)
    }))
})
