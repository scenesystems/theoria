import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import type { Direction } from "../../src/contracts/index.js"
import * as EffectSearch from "../../src/index.js"
import * as InternalHypervolume from "../../src/internal/hypervolume.js"
import * as InternalPareto from "../../src/internal/pareto.js"
import {
  computeMultiObjectiveWeights as computeMultiObjectiveWeightsInternal,
  computeReferencePoint as computeReferencePointInternal
} from "../../src/internal/tpe/multiObjectiveWeights.js"
import * as Pareto from "../../src/Pareto/index.js"

const makeDirections = (...values: ReadonlyArray<Direction>): ReadonlyArray<Direction> => Arr.fromIterable(values)

const MINIMIZE = makeDirections("minimize", "minimize")
const MIXED = makeDirections("minimize", "maximize")

const BASE_POINTS = Arr.make(
  Arr.make(1, 4),
  Arr.make(2, 2),
  Arr.make(3, 1),
  Arr.make(4, 3),
  Arr.make(2, 2)
)

describe("Pareto public API", () => {
  it.effect("exposes Pareto namespace from root public index", () =>
    Effect.sync(() => {
      expect(EffectSearch.Pareto).toBeDefined()
      expect(EffectSearch.Pareto.FrontierSnapshot).toBeDefined()
      expect(EffectSearch.Pareto.ObjectiveVectorSchema).toBeDefined()
      expect(EffectSearch.Pareto.ObjectiveFrontierHolding).toBeDefined()
      expect(EffectSearch.Pareto.ObjectiveFrontierWeight).toBeDefined()
      expect(EffectSearch.Pareto.dominates).toBe(Pareto.dominates)
      expect(EffectSearch.Pareto.dominatedIndices).toBe(Pareto.dominatedIndices)
      expect(EffectSearch.Pareto.frontierSnapshot).toBe(Pareto.frontierSnapshot)
      expect(EffectSearch.Pareto.maximizeDirections).toBe(Pareto.maximizeDirections)
      expect(EffectSearch.Pareto.objectiveHoldingWeights).toBe(Pareto.objectiveHoldingWeights)
      expect(EffectSearch.Pareto.nonDominatedIndices).toBe(Pareto.nonDominatedIndices)
      expect(EffectSearch.Pareto.nonDominatedSort).toBe(Pareto.nonDominatedSort)
      expect(EffectSearch.Pareto.nonDominatedRanks).toBe(Pareto.nonDominatedRanks)
      expect(EffectSearch.Pareto.objectiveFrontierHoldings).toBe(Pareto.objectiveFrontierHoldings)
      expect(EffectSearch.Pareto.objectiveFrontierWeights).toBe(Pareto.objectiveFrontierWeights)
      expect(EffectSearch.Pareto.ObjectiveWeightsSchema).toBe(Pareto.ObjectiveWeightsSchema)
      expect(EffectSearch.Pareto.computeMultiObjectiveWeights).toBe(Pareto.computeMultiObjectiveWeights)
      expect(EffectSearch.Pareto.computeReferencePoint).toBe(Pareto.computeReferencePoint)
      expect(EffectSearch.Pareto.hypervolume2d).toBe(Pareto.hypervolume2d)
      expect(EffectSearch.Pareto.hypervolumeContribution2d).toBe(Pareto.hypervolumeContribution2d)
    }))

  it.effect("preserves behavior parity with existing internal implementations", () =>
    Effect.sync(() => {
      const left = Arr.make(0.2, 0.8)
      const right = Arr.make(0.3, 0.7)
      const reference = Arr.make(4.4, 4.4)

      expect(Pareto.dominates(left, right, MIXED)).toBe(InternalPareto.dominates(left, right, MIXED))
      expect(Pareto.dominatedIndices(BASE_POINTS, MINIMIZE)).toEqual(
        InternalPareto.dominatedIndices(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.frontierSnapshot(BASE_POINTS, MINIMIZE)).toEqual(
        InternalPareto.frontierSnapshot(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.maximizeDirections(2)).toEqual(InternalPareto.maximizeDirections(2))
      expect(Pareto.nonDominatedIndices(BASE_POINTS, MINIMIZE)).toEqual(
        InternalPareto.nonDominatedIndices(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.nonDominatedSort(BASE_POINTS, MINIMIZE)).toEqual(
        InternalPareto.nonDominatedSort(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.nonDominatedRanks(BASE_POINTS, MINIMIZE)).toEqual(
        InternalPareto.nonDominatedRanks(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.objectiveFrontierHoldings(BASE_POINTS, MINIMIZE)).toEqual(
        InternalPareto.objectiveFrontierHoldings(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.objectiveFrontierWeights(BASE_POINTS, MINIMIZE)).toEqual(
        InternalPareto.objectiveFrontierWeights(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.objectiveHoldingWeights(BASE_POINTS, MINIMIZE)).toEqual(
        InternalPareto.objectiveHoldingWeights(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.computeReferencePoint(BASE_POINTS, MINIMIZE)).toEqual(
        computeReferencePointInternal(BASE_POINTS, MINIMIZE)
      )
      expect(Pareto.computeMultiObjectiveWeights(BASE_POINTS, reference, MINIMIZE)).toEqual(
        computeMultiObjectiveWeightsInternal(BASE_POINTS, reference, MINIMIZE)
      )

      expect(Pareto.hypervolume2d(BASE_POINTS, reference)).toBe(
        InternalHypervolume.hypervolume2d(BASE_POINTS, reference)
      )
      expect(Pareto.hypervolumeContribution2d(BASE_POINTS, reference)).toEqual(
        InternalHypervolume.hypervolumeContribution2d(BASE_POINTS, reference)
      )
    }))
})
