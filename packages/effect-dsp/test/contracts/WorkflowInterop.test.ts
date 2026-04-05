/**
 * Workflow-substrate interop contracts over effect-inference-owned schemas.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as DspContracts from "effect-dsp/contracts"

const decodeModuleId = (moduleName: string) =>
  Schema.decodeUnknown(DspContracts.ModuleId)(moduleName).pipe(Effect.orDie)

const workflowGraphInput = {
  manifest: {
    manifestId: "task-graph",
    workflowKind: "task-first",
    variant: "baseline",
    nodes: [
      {
        nodeId: "planner",
        nodeKind: "planner",
        runtimeRole: "task",
        inputLanes: ["task", "context"],
        outputLane: "conversation",
        loopPolicy: "single-pass",
        optimizationKnobRefs: ["planner-instructions"]
      },
      {
        nodeId: "drafter",
        nodeKind: "drafter",
        runtimeRole: "proposer",
        inputLanes: ["conversation"],
        outputLane: "conversation",
        loopPolicy: "bounded-critique",
        optimizationKnobRefs: ["draft-length"]
      },
      {
        nodeId: "responder",
        nodeKind: "responder",
        runtimeRole: "evaluator",
        inputLanes: ["conversation", "render"],
        outputLane: "conversation",
        loopPolicy: "single-pass",
        optimizationKnobRefs: []
      }
    ],
    edges: [
      {
        edgeId: "planner-to-drafter",
        kind: "next",
        fromNodeId: "planner",
        toNodeId: "drafter"
      },
      {
        edgeId: "drafter-to-responder",
        kind: "feedback",
        fromNodeId: "drafter",
        toNodeId: "responder"
      }
    ],
    optimizationKnobs: [
      {
        key: "planner-instructions",
        kind: "instruction-profile",
        choices: ["baseline", "optimized"]
      },
      {
        key: "draft-length",
        kind: "response-length-target",
        choices: ["short", "medium"]
      }
    ]
  },
  projection: {
    manifestId: "task-graph",
    entryNodeId: "planner",
    terminalNodeIds: ["responder"],
    activeStateLanes: ["task", "conversation", "render"]
  }
}

describe("contracts/WorkflowInterop", () => {
  it("pins session, score, render, and artifact ownership to sibling package authorities", () => {
    expect(DspContracts.workflowInteropOwnership.sessionAndRouting).toBe("effect-inference")
    expect(DspContracts.workflowInteropOwnership.scoreAggregation).toBe("effect-math")
    expect(DspContracts.workflowInteropOwnership.renderEvaluation).toBe("effect-text")
    expect(DspContracts.workflowInteropOwnership.artifactTransport).toBe("effect-search")
  })

  it.effect("projects workflow manifests through deterministic traversal semantics shared with ModuleGraphProjection", () =>
    Effect.gen(function*() {
      const input = yield* Schema.decodeUnknown(DspContracts.WorkflowModuleGraphInputSchema)(workflowGraphInput)
      const plannerId = yield* decodeModuleId("planner")
      const drafterId = yield* decodeModuleId("drafter")
      const responderId = yield* decodeModuleId("responder")
      const moduleProjection = DspContracts.projectOptimizationModuleGraph(
        DspContracts.makeModuleGraph({
          rootId: plannerId,
          nodes: [
            new DspContracts.ModuleGraphNode({
              moduleId: plannerId,
              signature: DspContracts.makeModuleNodeSignature("Planner", "Planner instructions"),
              subModuleIds: [drafterId]
            }),
            new DspContracts.ModuleGraphNode({
              moduleId: drafterId,
              signature: DspContracts.makeModuleNodeSignature("Drafter", "Drafter instructions"),
              subModuleIds: [responderId]
            }),
            new DspContracts.ModuleGraphNode({
              moduleId: responderId,
              signature: DspContracts.makeModuleNodeSignature("Responder", "Responder instructions"),
              subModuleIds: []
            })
          ],
          edges: [
            new DspContracts.ModuleGraphEdge({ parentId: plannerId, childId: drafterId }),
            new DspContracts.ModuleGraphEdge({ parentId: drafterId, childId: responderId })
          ]
        })
      )
      const workflowProjection = DspContracts.projectWorkflowModuleGraph(input)
      const workflowLineages = workflowProjection.lineages.map((lineage) => ({
        targetNodeId: lineage.targetNodeId,
        path: lineage.path
      }))
      const moduleLineages = moduleProjection.lineages.map((lineage) => ({
        targetNodeId: lineage.targetId,
        path: lineage.path
      }))

      expect(workflowProjection.manifestId).toBe(input.manifest.manifestId)
      expect(workflowProjection.entryNodeId).toBe(input.projection.entryNodeId)
      expect(workflowProjection.activeStateLanes).toEqual(input.projection.activeStateLanes)
      expect(workflowProjection.traversal).toEqual(moduleProjection.traversal)
      expect(workflowLineages).toEqual(moduleLineages)
    }))
})
