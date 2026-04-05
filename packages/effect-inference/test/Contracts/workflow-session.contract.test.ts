import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

const taskFirstRecord = {
  recordId: "workflow-task-1",
  workflowKind: "task-first",
  session: {
    sessionId: "session-task-1",
    workflowKind: "task-first",
    turns: [{ turnId: "turn-1", role: "user", content: "Explain runtime provenance in one sentence." }],
    stateLanes: [
      { lane: "task", entries: ["runtime-provenance-summary"] },
      { lane: "context", entries: ["concise"] }
    ]
  },
  graph: {
    manifestId: "graph-task-1",
    workflowKind: "task-first",
    variant: "baseline",
    nodes: [
      {
        nodeId: "planner",
        nodeKind: "planner",
        runtimeRole: "proposer",
        capabilityRequirements: { textGeneration: true, structuredOutput: "best-effort" },
        inputLanes: ["task", "context"],
        outputLane: "conversation",
        loopPolicy: "single-pass",
        optimizationKnobRefs: ["instruction-profile"]
      },
      {
        nodeId: "responder",
        nodeKind: "responder",
        runtimeRole: "task",
        capabilityRequirements: { textGeneration: true, streaming: true },
        inputLanes: ["conversation"],
        outputLane: "conversation",
        loopPolicy: "single-pass",
        optimizationKnobRefs: ["response-length-target"]
      }
    ],
    edges: [{ edgeId: "planner-to-responder", kind: "next", fromNodeId: "planner", toNodeId: "responder" }],
    optimizationKnobs: [
      { key: "instruction-profile", kind: "instruction-profile", choices: ["concise", "stepwise"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["short", "medium"] }
    ]
  },
  projection: {
    manifestId: "graph-task-1",
    entryNodeId: "planner",
    terminalNodeIds: ["responder"],
    activeStateLanes: ["task", "conversation"]
  },
  evaluation: {
    workflowKind: "task-first",
    profileId: "task-default",
    cases: [
      {
        caseId: "case-task-1",
        prompt: "Explain runtime provenance in one sentence.",
        expectedSignals: ["requested runtime", "resolved runtime"],
        renderCritical: false
      }
    ]
  }
}

const chatContinuationRecord = {
  recordId: "workflow-chat-1",
  workflowKind: "chat-continuation",
  session: {
    sessionId: "session-chat-1",
    workflowKind: "chat-continuation",
    turns: [
      { turnId: "turn-1", role: "system", content: "You are a concise runtime analyst." },
      { turnId: "turn-2", role: "user", content: "Summarize the route decision." },
      { turnId: "turn-3", role: "assistant", content: "The runtime selected the Hugging Face router." },
      { turnId: "turn-4", role: "user", content: "Continue with the resolved model and finish reason." }
    ],
    stateLanes: [
      { lane: "conversation", entries: ["route-summary", "follow-up-request"] },
      { lane: "render", entries: ["compact-panel"] }
    ]
  },
  graph: {
    manifestId: "graph-chat-1",
    workflowKind: "chat-continuation",
    variant: "optimized",
    nodes: [
      {
        nodeId: "handoff",
        nodeKind: "chat-handoff",
        runtimeRole: "teacher",
        capabilityRequirements: { textGeneration: true },
        inputLanes: ["conversation"],
        outputLane: "conversation",
        loopPolicy: "single-pass",
        optimizationKnobRefs: ["runtime-profile"]
      },
      {
        nodeId: "reply",
        nodeKind: "responder",
        runtimeRole: "task",
        capabilityRequirements: { textGeneration: true, streaming: true },
        inputLanes: ["conversation", "render"],
        outputLane: "conversation",
        loopPolicy: "bounded-retry",
        optimizationKnobRefs: ["surface-profile", "response-length-target"]
      }
    ],
    edges: [{ edgeId: "handoff-to-reply", kind: "handoff", fromNodeId: "handoff", toNodeId: "reply" }],
    optimizationKnobs: [
      { key: "runtime-profile", kind: "runtime-profile", choices: ["fastest", "preferred"] },
      { key: "surface-profile", kind: "surface-profile", choices: ["sidebar", "full-panel"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["short", "medium"] }
    ]
  },
  projection: {
    manifestId: "graph-chat-1",
    entryNodeId: "handoff",
    terminalNodeIds: ["reply"],
    activeStateLanes: ["conversation", "render"]
  },
  evaluation: {
    workflowKind: "chat-continuation",
    profileId: "chat-default",
    cases: [
      {
        caseId: "case-chat-1",
        prompt: "Continue the conversation with resolved model evidence.",
        expectedSignals: ["response model", "finish reason"],
        renderCritical: true
      }
    ]
  }
}

describe("Contracts/workflow-session", () => {
  it("decodes task-first workflow session, graph, projection, evaluation, and record shapes", () => {
    const session = Schema.decodeUnknownEither(Contracts.SessionManifestSchema)(taskFirstRecord.session, {
      onExcessProperty: "error"
    })
    const node = Schema.decodeUnknownEither(Contracts.NodeExecutionContractSchema)(taskFirstRecord.graph.nodes[0], {
      onExcessProperty: "error"
    })
    const graph = Schema.decodeUnknownEither(Contracts.GraphExecutionManifestSchema)(taskFirstRecord.graph, {
      onExcessProperty: "error"
    })
    const projection = Schema.decodeUnknownEither(Contracts.GraphExecutionProjectionSchema)(
      taskFirstRecord.projection,
      {
        onExcessProperty: "error"
      }
    )
    const evaluation = Schema.decodeUnknownEither(Contracts.EvaluationContractSchema)(taskFirstRecord.evaluation, {
      onExcessProperty: "error"
    })
    const record = Schema.decodeUnknownEither(Contracts.WorkflowExecutionRecordSchema)(taskFirstRecord, {
      onExcessProperty: "error"
    })

    expect(Either.isRight(session)).toBe(true)
    expect(Either.isRight(node)).toBe(true)
    expect(Either.isRight(graph)).toBe(true)
    expect(Either.isRight(projection)).toBe(true)
    expect(Either.isRight(evaluation)).toBe(true)
    expect(Either.isRight(record)).toBe(true)
  })

  it("decodes chat-continuation workflow records and round-trips them deterministically", () => {
    const decoded = Schema.decodeUnknownSync(Contracts.WorkflowExecutionRecordSchema)(chatContinuationRecord, {
      onExcessProperty: "error"
    })
    const encoded = Schema.encodeSync(Contracts.WorkflowExecutionRecordSchema)(decoded)

    expect(encoded).toEqual(chatContinuationRecord)
  })

  it("rejects invalid workflow and node-role shapes", () => {
    const invalidWorkflow = Schema.decodeUnknownEither(Contracts.SessionManifestSchema)(
      {
        ...taskFirstRecord.session,
        workflowKind: "task"
      },
      { onExcessProperty: "error" }
    )
    const invalidNodeRole = Schema.decodeUnknownEither(Contracts.NodeExecutionContractSchema)(
      {
        ...chatContinuationRecord.graph.nodes[0],
        runtimeRole: "planner"
      },
      { onExcessProperty: "error" }
    )

    expect(Either.isLeft(invalidWorkflow)).toBe(true)
    expect(Either.isLeft(invalidNodeRole)).toBe(true)
  })

  it("round-trips task-first workflow records deterministically", () => {
    const decoded = Schema.decodeUnknownSync(Contracts.WorkflowExecutionRecordSchema)(taskFirstRecord, {
      onExcessProperty: "error"
    })
    const encoded = Schema.encodeSync(Contracts.WorkflowExecutionRecordSchema)(decoded)

    expect(encoded).toEqual(taskFirstRecord)
  })
})
