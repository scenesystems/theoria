/**
 * Pareto module interop proofs through effectSearchInterop.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"
import { effectSearchInterop } from "../../src/optimizers/effectSearchInterop/index.js"

describe("integration/effectSearchInterop Pareto", () => {
  it.effect("routes Pareto ranking and hypervolume through the public interop seam", () =>
    Effect.sync(() => {
      const objectiveVectors = Arr.make(
        Arr.make(1, 1),
        Arr.make(2, 0),
        Arr.make(0, 2),
        Arr.make(1.5, 1.5)
      )
      const directions: ReadonlyArray<"maximize" | "minimize"> = ["maximize", "maximize"]

      const dominates = effectSearchInterop.pareto.dominates(
        Arr.make(1.5, 1.5),
        Arr.make(1, 1),
        directions
      )
      const indices = effectSearchInterop.pareto.nonDominatedIndices(objectiveVectors, directions)
      const fronts = effectSearchInterop.pareto.nonDominatedSort(objectiveVectors, directions)
      const ranks = effectSearchInterop.pareto.nonDominatedRanks(objectiveVectors, directions)
      const hypervolume = effectSearchInterop.pareto.hypervolume2d(
        objectiveVectors,
        Arr.make(0, 0),
        directions
      )
      const contributions = effectSearchInterop.pareto.hypervolumeContribution2d(
        objectiveVectors,
        Arr.make(0, 0),
        directions
      )

      expect(dominates).toBe(true)
      expect(indices).toEqual([1, 2, 3])
      expect(fronts).toEqual([[1, 2, 3], [0]])
      expect(ranks).toEqual([1, 0, 0, 0])
      expect(hypervolume).toBeGreaterThan(0)
      expect(contributions).toHaveLength(4)
      expect(contributions[0]).toBe(0)
    }))
})
