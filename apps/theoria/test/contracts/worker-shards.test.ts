import { assert, it } from "@effect/vitest"
import { Array, Effect, Schema } from "effect"

import { balancedShards, Shard, shardOf } from "../worker/shards.js"

const File = Schema.Struct({ key: Schema.String, weight: Schema.Finite })
const files = [
  File.make({ key: "d", weight: 2 }),
  File.make({ key: "b", weight: 7 }),
  File.make({ key: "a", weight: 9 }),
  File.make({ key: "c", weight: 4 })
]
const weightOf = (file: typeof File.Type) => file.weight
const keyOf = (file: typeof File.Type) => file.key

it.effect("balances descending weights and selects shards using one-based indices", () =>
  Effect.sync(() => {
    assert.deepStrictEqual(Array.map(balancedShards(files, 2, weightOf, keyOf), (bin) => Array.map(bin, keyOf)), [
      ["a", "d"],
      ["b", "c"]
    ])
    assert.deepStrictEqual(Array.map(shardOf(files, Shard.make({ index: 2, count: 2 }), weightOf, keyOf), keyOf), [
      "b",
      "c"
    ])
  }))

it.effect("breaks equal-weight ties by key and preserves empty shards", () =>
  Effect.sync(() => {
    const tied = [File.make({ key: "z", weight: 3 }), File.make({ key: "a", weight: 3 })]
    assert.deepStrictEqual(Array.map(balancedShards(tied, 3, weightOf, keyOf), (bin) => Array.map(bin, keyOf)), [
      ["a"],
      ["z"],
      []
    ])
    assert.deepStrictEqual(shardOf(tied, Shard.make({ index: 3, count: 3 }), weightOf, keyOf), [])
  }))

it.effect("rejects zero, negative, and fractional shard coordinates", () =>
  Effect.sync(() => {
    assert.isTrue(Schema.is(Shard)({ index: 1, count: 1 }))
    assert.isFalse(Schema.is(Shard)({ index: 0, count: 2 }))
    assert.isFalse(Schema.is(Shard)({ index: 1, count: -1 }))
    assert.isFalse(Schema.is(Shard)({ index: 1.5, count: 2 }))
  }))
