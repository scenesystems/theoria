import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import * as Order from "effect/Order"

import { balancedShards, shardOf } from "../worker/shards.js"

/**
 * The Chromium suite runs its files serially, one runner per shard, so a
 * shard's wall time is the sum of its files' times. Vitest's own `--shard`
 * cuts the file list by path hash, which puts no bound on that sum; the suite
 * cuts it by weight instead — longest first, each file to the lightest shard
 * so far — so no shard carries more than a fair share plus one file.
 */
describe("Browser suite shards contract", () => {
  const files = [
    { path: "home-demo-answers", weight: 50 },
    { path: "home-demo-page", weight: 45 },
    { path: "home-demo-search", weight: 44 },
    { path: "home-environment", weight: 73 },
    { path: "home-forced-colors", weight: 43 },
    { path: "home-form", weight: 25 },
    { path: "home-pending", weight: 25 },
    { path: "home-resize", weight: 16 },
    { path: "home-rhythm", weight: 5 },
    { path: "home-surfaces", weight: 18 },
    { path: "home-vitals", weight: 25 },
    { path: "home", weight: 12 },
    { path: "docs-routes", weight: 18 },
    { path: "docs", weight: 14 },
    { path: "place-build-limit", weight: 4 },
    { path: "site", weight: 3 }
  ]
  const weightOf = (file: { readonly weight: number }) => file.weight
  const keyOf = (file: { readonly path: string }) => file.path
  const total = (shard: ReadonlyArray<{ readonly weight: number }>) =>
    Arr.reduce(shard, 0, (sum, file) => sum + file.weight)

  it.effect("every file runs in exactly one shard", () =>
    Effect.gen(function*() {
      const shards = balancedShards(files, 4, weightOf, keyOf)
      expect(shards.length).toBe(4)
      const placed = Arr.sort(Arr.map(Arr.flatten(shards), keyOf), Order.string)
      expect(placed).toEqual(Arr.sort(Arr.map(files, keyOf), Order.string))
    }))

  it.effect("no shard carries more than the fair share plus its heaviest file", () =>
    Effect.gen(function*() {
      const shards = balancedShards(files, 4, weightOf, keyOf)
      const fairShare = total(files) / 4
      const heaviest = Arr.reduce(files, 0, (max, file) => Math.max(max, file.weight))
      const heaviestShard = Arr.reduce(shards, 0, (max, shard) => Math.max(max, total(shard)))
      expect(heaviestShard).toBeLessThanOrEqual(fairShare + heaviest)
      // With these weights the bound is not loose: the heaviest shard is within one light file of the fair share.
      expect(heaviestShard).toBeLessThanOrEqual(fairShare + 5)
    }))

  it.effect("the heaviest files are spread out, one per shard, rather than cut by name", () =>
    Effect.gen(function*() {
      const shards = balancedShards(files, 4, weightOf, keyOf)
      const heaviestIn = (shard: ReadonlyArray<{ readonly path: string; readonly weight: number }>) =>
        Arr.reduce(shard, 0, (max, file) => Math.max(max, file.weight))
      expect(Arr.map(shards, heaviestIn)).toEqual([73, 50, 45, 44])
      // The three demo files, named alike, are in three shards.
      const demoShards = Arr.filterMap(shards, (shard, index) =>
        Arr.some(shard, (file) =>
            file.path.startsWith("home-demo"))
          ? Option.some(index)
          : Option.none())
      expect(demoShards.length).toBe(3)
    }))

  it.effect("the cut is the same whatever order the files arrive in", () =>
    Effect.gen(function*() {
      const forwards = balancedShards(files, 3, weightOf, keyOf)
      const backwards = balancedShards(Arr.reverse(files), 3, weightOf, keyOf)
      expect(Arr.map(backwards, (shard) => Arr.map(shard, keyOf))).toEqual(
        Arr.map(forwards, (shard) => Arr.map(shard, keyOf))
      )
    }))

  it.effect("files of one weight are told apart by name, so equal weights still cut the same way", () =>
    Effect.gen(function*() {
      const alike = [{ path: "b" }, { path: "a" }, { path: "c" }, { path: "d" }]
      const shards = balancedShards(alike, 2, () => 1, keyOf)
      expect(Arr.map(shards, (shard) => Arr.map(shard, keyOf))).toEqual([["a", "c"], ["b", "d"]])
    }))

  it.effect("a shard is asked for by its one-based index, as on the vitest command line", () =>
    Effect.gen(function*() {
      const shards = balancedShards(files, 4, weightOf, keyOf)
      expect(shardOf(files, { index: 1, count: 4 }, weightOf, keyOf)).toEqual(shards[0])
      expect(shardOf(files, { index: 4, count: 4 }, weightOf, keyOf)).toEqual(shards[3])
    }))

  it.effect("more shards than files leaves the last shards empty rather than failing", () =>
    Effect.gen(function*() {
      const two = [{ path: "a", weight: 2 }, { path: "b", weight: 1 }]
      expect(shardOf(two, { index: 3, count: 3 }, weightOf, keyOf)).toEqual([])
    }))
})
