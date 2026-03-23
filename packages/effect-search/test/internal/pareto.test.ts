import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import type { Direction } from "../../src/contracts/index.js"

import { dominates, nonDominatedIndices, nonDominatedRanks, nonDominatedSort } from "../../src/internal/pareto.js"

const makeDirections = (...values: ReadonlyArray<Direction>): ReadonlyArray<Direction> => Arr.fromIterable(values)

const MINIMIZE_DIRECTIONS = makeDirections("minimize", "minimize")
const MIXED_DIRECTIONS = makeDirections("minimize", "maximize")
const BASE_POINTS = Arr.make(
  Arr.make(1, 4),
  Arr.make(2, 2),
  Arr.make(3, 1),
  Arr.make(4, 3),
  Arr.make(2, 2)
)

describe("pareto kernel", () => {
  it.effect("supports direction-aware dominance", () =>
    Effect.sync(() => {
      const left = Arr.make(0.2, 0.8)
      const right = Arr.make(0.3, 0.7)

      expect(dominates(left, right, MIXED_DIRECTIONS)).toBe(true)
      expect(dominates(right, left, MIXED_DIRECTIONS)).toBe(false)
    }))

  it.effect("returns deterministic non-dominated indices with stable duplicate handling", () =>
    Effect.sync(() => {
      expect(nonDominatedIndices(BASE_POINTS, MINIMIZE_DIRECTIONS)).toEqual(Arr.make(0, 1, 2, 4))
    }))

  it.effect("produces deterministic front peeling and rank vectors", () =>
    Effect.sync(() => {
      expect(nonDominatedSort(BASE_POINTS, MINIMIZE_DIRECTIONS)).toEqual(
        Arr.make(Arr.make(0, 1, 2, 4), Arr.make(3))
      )
      expect(nonDominatedRanks(BASE_POINTS, MINIMIZE_DIRECTIONS)).toEqual(Arr.make(0, 0, 0, 1, 0))
    }))

  it.effect("preserves exact dominance behavior when epsilon is omitted or zero", () =>
    Effect.sync(() => {
      const left = Arr.make(1, 2)
      const right = Arr.make(1, 3)

      expect(dominates(left, right, MINIMIZE_DIRECTIONS)).toBe(
        dominates(left, right, MINIMIZE_DIRECTIONS, 0)
      )
      expect(nonDominatedIndices(BASE_POINTS, MINIMIZE_DIRECTIONS))
        .toEqual(nonDominatedIndices(BASE_POINTS, MINIMIZE_DIRECTIONS, 0))
      expect(nonDominatedSort(BASE_POINTS, MINIMIZE_DIRECTIONS))
        .toEqual(nonDominatedSort(BASE_POINTS, MINIMIZE_DIRECTIONS, 0))
      expect(nonDominatedRanks(BASE_POINTS, MINIMIZE_DIRECTIONS))
        .toEqual(nonDominatedRanks(BASE_POINTS, MINIMIZE_DIRECTIONS, 0))
    }))

  it.effect("requires an epsilon margin in every objective when epsilon is positive", () =>
    Effect.sync(() => {
      const incumbent = Arr.make(0.5, 0.5)
      const nearTie = Arr.make(0.55, 0.52)
      const clearlyDominated = Arr.make(0.72, 0.3)

      expect(dominates(incumbent, nearTie, MINIMIZE_DIRECTIONS)).toBe(true)
      expect(dominates(incumbent, nearTie, MINIMIZE_DIRECTIONS, 0.1)).toBe(false)
      expect(dominates(incumbent, clearlyDominated, MIXED_DIRECTIONS, 0.1)).toBe(true)
    }))
})
