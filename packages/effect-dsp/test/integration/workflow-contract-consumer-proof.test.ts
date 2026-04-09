import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import {
  GraphExecutionManifestSchema,
  GraphExecutionProjectionSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"

import {
  WorkflowInteropOwnership,
  WorkflowModuleGraphInputSchema,
  WorkflowModuleGraphProjection
} from "effect-dsp/contracts"

const workflowManifestFixture = {
  manifestId: "chat-handoff-proof",
  workflowKind: "chat-continuation",
  variant: "optimized",
  nodes: [
    {
      nodeId: "router",
      nodeKind: "planner",
      runtimeRole: "task",
      inputLanes: ["conversation", "context"],
      outputLane: "conversation",
      loopPolicy: "single-pass",
      optimizationKnobRefs: ["routing-style"]
    },
    {
      nodeId: "handoff",
      nodeKind: "chat-handoff",
      runtimeRole: "proposer",
      inputLanes: ["conversation"],
      outputLane: "conversation",
      loopPolicy: "bounded-critique",
      optimizationKnobRefs: []
    },
    {
      nodeId: "answer",
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
      edgeId: "router-to-handoff",
      kind: "next",
      fromNodeId: "router",
      toNodeId: "handoff"
    },
    {
      edgeId: "handoff-to-answer",
      kind: "feedback",
      fromNodeId: "handoff",
      toNodeId: "answer"
    }
  ],
  optimizationKnobs: [
    {
      key: "routing-style",
      kind: "instruction-profile",
      choices: ["baseline", "handoff-optimized"]
    }
  ]
}

const workflowProjectionFixture = {
  manifestId: "chat-handoff-proof",
  entryNodeId: "router",
  terminalNodeIds: ["answer"],
  activeStateLanes: ["conversation", "render"]
}

describe("integration/workflow-contract-consumer-proof", () => {
  it.effect("consumes effect-inference workflow contracts before crossing into DSP interop projections", () =>
    Effect.gen(function*() {
      const workflowKind = yield* Schema.decodeUnknown(WorkflowKindSchema)(workflowManifestFixture.workflowKind)
      const manifest = yield* Schema.decodeUnknown(GraphExecutionManifestSchema)({
        ...workflowManifestFixture,
        workflowKind
      })
      const projection = yield* Schema.decodeUnknown(GraphExecutionProjectionSchema)(workflowProjectionFixture)
      const input = yield* Schema.decodeUnknown(WorkflowModuleGraphInputSchema)({
        manifest,
        projection
      })
      const graphProjection = WorkflowModuleGraphProjection.fromWorkflowInput(input)

      expect(WorkflowInteropOwnership.current.sessionAndRouting).toBe("effect-inference")
      expect(graphProjection.traversal).toEqual(["router", "handoff", "answer"])
      expect(
        graphProjection.lineages.map((lineage) => ({
          targetNodeId: lineage.targetNodeId,
          path: lineage.path
        }))
      ).toEqual([
        { targetNodeId: "answer", path: ["router", "handoff", "answer"] },
        { targetNodeId: "handoff", path: ["router", "handoff"] },
        { targetNodeId: "router", path: ["router"] }
      ])
      expect(graphProjection.activeStateLanes).toEqual(workflowProjectionFixture.activeStateLanes)
    }))
})
