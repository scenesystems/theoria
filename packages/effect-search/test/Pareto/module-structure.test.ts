import { describe, expect, it } from "@effect/vitest"
import { Effect, Record as Rec } from "effect"

import * as EffectSearch from "../../src/index.js"
import * as InternalHypervolume from "../../src/internal/hypervolume.js"
import * as InternalPareto from "../../src/internal/pareto.js"
import * as Dominance from "../../src/Pareto/dominance.js"
import * as Frontier from "../../src/Pareto/frontier.js"
import * as Hypervolume from "../../src/Pareto/hypervolume.js"
import * as Pareto from "../../src/Pareto/index.js"
import * as Model from "../../src/Pareto/model.js"
import * as MultiObjective from "../../src/Pareto/multiObjective.js"
import * as Weights from "../../src/Pareto/weights.js"

describe("Pareto module structure", () => {
  it.effect("keeps a thin facade that forwards focused module exports", () =>
    Effect.sync(() => {
      expect(Pareto.ObjectiveVectorSchema).toBe(Model.ObjectiveVectorSchema)
      expect(Pareto.ObjectiveFrontierHolding).toBe(Model.ObjectiveFrontierHolding)
      expect(Pareto.ObjectiveFrontierWeight).toBe(Model.ObjectiveFrontierWeight)
      expect(Pareto.FrontierSnapshot).toBe(Model.FrontierSnapshot)
      expect(Pareto.dominates).toBe(Dominance.dominates)
      expect(Pareto.dominatedIndices).toBe(Weights.dominatedIndices)
      expect(Pareto.frontierSnapshot).toBe(Weights.frontierSnapshot)
      expect(Pareto.maximizeDirections).toBe(Weights.maximizeDirections)
      expect(Pareto.objectiveHoldingWeights).toBe(Weights.objectiveHoldingWeights)
      expect(Pareto.nonDominatedIndices).toBe(Frontier.nonDominatedIndices)
      expect(Pareto.nonDominatedSort).toBe(Frontier.nonDominatedSort)
      expect(Pareto.nonDominatedRanks).toBe(Frontier.nonDominatedRanks)
      expect(Pareto.objectiveFrontierHoldings).toBe(Frontier.objectiveFrontierHoldings)
      expect(Pareto.objectiveFrontierWeights).toBe(Weights.objectiveFrontierWeights)
      expect(Pareto.ObjectiveWeightsSchema).toBe(MultiObjective.ObjectiveWeightsSchema)
      expect(Pareto.computeReferencePoint).toBe(MultiObjective.computeReferencePoint)
      expect(Pareto.computeMultiObjectiveWeights).toBe(MultiObjective.computeMultiObjectiveWeights)
      expect(Pareto.hypervolume2d).toBe(Hypervolume.hypervolume2d)
      expect(Pareto.hypervolumeContribution2d).toBe(Hypervolume.hypervolumeContribution2d)
    }))

  it.effect("keeps internal compatibility shims wired to the same public implementation", () =>
    Effect.sync(() => {
      expect(InternalPareto.ObjectiveVectorSchema).toBe(Pareto.ObjectiveVectorSchema)
      expect(InternalPareto.ObjectiveFrontierHolding).toBe(Pareto.ObjectiveFrontierHolding)
      expect(InternalPareto.ObjectiveFrontierWeight).toBe(Pareto.ObjectiveFrontierWeight)
      expect(InternalPareto.FrontierSnapshot).toBe(Pareto.FrontierSnapshot)
      expect(InternalPareto.dominates).toBe(Pareto.dominates)
      expect(InternalPareto.dominatedIndices).toBe(Pareto.dominatedIndices)
      expect(InternalPareto.frontierSnapshot).toBe(Pareto.frontierSnapshot)
      expect(InternalPareto.maximizeDirections).toBe(Pareto.maximizeDirections)
      expect(InternalPareto.objectiveHoldingWeights).toBe(Pareto.objectiveHoldingWeights)
      expect(InternalPareto.nonDominatedIndices).toBe(Pareto.nonDominatedIndices)
      expect(InternalPareto.nonDominatedSort).toBe(Pareto.nonDominatedSort)
      expect(InternalPareto.nonDominatedRanks).toBe(Pareto.nonDominatedRanks)
      expect(InternalPareto.objectiveFrontierHoldings).toBe(Pareto.objectiveFrontierHoldings)
      expect(InternalPareto.objectiveFrontierWeights).toBe(Pareto.objectiveFrontierWeights)
      expect(InternalHypervolume.hypervolume2d).toBe(Pareto.hypervolume2d)
      expect(InternalHypervolume.hypervolumeContribution2d).toBe(Pareto.hypervolumeContribution2d)
    }))

  it.effect("declares focused modules with a root Pareto namespace facade", () =>
    Effect.sync(() => {
      expect(EffectSearch.Pareto).toBeDefined()

      expect(Rec.keys(Model)).toEqual([
        "ObjectiveVectorSchema",
        "ObjectiveFrontierHolding",
        "ObjectiveFrontierWeight",
        "FrontierSnapshot"
      ])
      expect(Rec.keys(Dominance)).toEqual([
        "normalizePoint",
        "normalizeMatrix",
        "validateRectangular",
        "dominatesNormalized",
        "dominates"
      ])
      expect(Rec.keys(Frontier)).toEqual([
        "nonDominatedIndices",
        "nonDominatedSort",
        "nonDominatedRanks",
        "objectiveFrontierHoldings"
      ])
      expect(Rec.keys(Weights)).toEqual([
        "maximizeDirections",
        "dominatedIndices",
        "objectiveFrontierWeights",
        "objectiveHoldingWeights",
        "frontierSnapshot"
      ])
      expect(Rec.keys(Hypervolume)).toEqual([
        "hypervolume2d",
        "hypervolumeContribution2d"
      ])
      expect(Rec.keys(MultiObjective)).toEqual([
        "ObjectiveWeightsSchema",
        "computeReferencePoint",
        "computeMultiObjectiveWeights"
      ])

      expect(Rec.keys(Pareto)).toEqual([
        "FrontierSnapshot",
        "ObjectiveFrontierHolding",
        "ObjectiveFrontierWeight",
        "ObjectiveVectorSchema",
        "ObjectiveWeightsSchema",
        "dominates",
        "dominatedIndices",
        "frontierSnapshot",
        "maximizeDirections",
        "objectiveFrontierWeights",
        "objectiveHoldingWeights",
        "nonDominatedIndices",
        "nonDominatedRanks",
        "nonDominatedSort",
        "objectiveFrontierHoldings",
        "computeMultiObjectiveWeights",
        "computeReferencePoint",
        "hypervolume2d",
        "hypervolumeContribution2d"
      ])
    }))
})
