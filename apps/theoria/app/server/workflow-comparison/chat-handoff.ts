import { Array as Arr } from "effect"

import { type WorkflowComparison, workflowComparisonAuthorityBindings } from "../../contracts/workflow/comparison.js"
import { makeWorkflowEvaluationReport, makeWorkflowExecutionRecord } from "./decode.js"
import { workflowProfileLibrary } from "./profile-library.js"

const baselineRecord = makeWorkflowExecutionRecord({
  recordId: "chat-handoff-baseline",
  workflowKind: "chat-continuation",
  session: {
    sessionId: "chat-handoff-session",
    workflowKind: "chat-continuation",
    turns: [
      {
        turnId: "chat-turn-1",
        role: "system",
        content: "Keep the response concise and grounded in current runtime evidence."
      },
      { turnId: "chat-turn-2", role: "user", content: "Why did the latest route change?" },
      {
        turnId: "chat-turn-3",
        role: "assistant",
        content: "The previous reply did not explain the runtime tradeoff clearly."
      },
      {
        turnId: "chat-turn-4",
        role: "user",
        content: "Continue with the route reason and the most relevant supporting detail."
      }
    ],
    stateLanes: [{ lane: "conversation", entries: ["follow-up"] }, { lane: "render", entries: ["sidebar"] }]
  },
  graph: {
    manifestId: "chat-handoff-graph",
    workflowKind: "chat-continuation",
    variant: "baseline",
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
        loopPolicy: "single-pass",
        optimizationKnobRefs: ["surface-profile", "response-length-target"]
      }
    ],
    edges: [{ edgeId: "chat-handoff-to-reply", kind: "handoff", fromNodeId: "handoff", toNodeId: "reply" }],
    optimizationKnobs: [
      { key: "runtime-profile", kind: "runtime-profile", choices: ["fastest", "preferred"] },
      { key: "surface-profile", kind: "surface-profile", choices: ["sidebar", "full-panel"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["short", "medium"] }
    ]
  },
  projection: {
    manifestId: "chat-handoff-graph",
    entryNodeId: "handoff",
    terminalNodeIds: ["reply"],
    activeStateLanes: ["conversation", "render"]
  },
  evaluation: {
    workflowKind: "chat-continuation",
    profileId: workflowProfileLibrary.chatOriented.profileId,
    profileFamily: workflowProfileLibrary.chatOriented.profileFamily,
    cases: [
      {
        caseId: "chat-case-1",
        prompt: "Continue the conversation with the route reason in one paragraph.",
        expectedSignals: ["route delta", "supporting evidence"],
        renderCritical: true
      },
      {
        caseId: "chat-case-2",
        prompt: "Return a response that preserves the user's latest constraint and stays readable in a narrow panel.",
        expectedSignals: ["constraint continuity", "render fit"],
        renderCritical: true
      }
    ]
  }
})

const optimizedRecord = makeWorkflowExecutionRecord({
  ...baselineRecord,
  recordId: "chat-handoff-optimized",
  graph: {
    ...baselineRecord.graph,
    variant: "optimized",
    nodes: Arr.appendAll(baselineRecord.graph.nodes, [
      {
        nodeId: "retrieval",
        nodeKind: "retrieval",
        runtimeRole: "evaluator",
        capabilityRequirements: { embeddings: true, usageReporting: true },
        inputLanes: ["conversation"],
        outputLane: "retrieval",
        loopPolicy: "single-pass",
        optimizationKnobRefs: ["retrieval-enabled", "retrieval-depth"]
      },
      {
        nodeId: "render-check",
        nodeKind: "render-evaluator",
        runtimeRole: "evaluator",
        capabilityRequirements: { textGeneration: true },
        inputLanes: ["conversation", "render"],
        outputLane: "render",
        loopPolicy: "bounded-retry",
        optimizationKnobRefs: ["render-check-enabled", "surface-profile"]
      }
    ]),
    edges: Arr.appendAll(baselineRecord.graph.edges, [
      { edgeId: "chat-handoff-to-retrieval", kind: "retrieval", fromNodeId: "handoff", toNodeId: "retrieval" },
      { edgeId: "chat-retrieval-to-reply", kind: "retrieval", fromNodeId: "retrieval", toNodeId: "reply" },
      { edgeId: "chat-reply-to-render-check", kind: "render-check", fromNodeId: "reply", toNodeId: "render-check" }
    ]),
    // The first choice in each optimized knob encodes the authored optimized default.
    optimizationKnobs: [
      { key: "runtime-profile", kind: "runtime-profile", choices: ["preferred", "fastest"] },
      { key: "surface-profile", kind: "surface-profile", choices: ["sidebar", "full-panel"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["medium", "short"] },
      { key: "retrieval-enabled", kind: "node-enabled", choices: ["enabled", "disabled"] },
      { key: "retrieval-depth", kind: "retrieval-depth", choices: ["3", "5", "1"] },
      { key: "render-check-enabled", kind: "node-enabled", choices: ["enabled", "disabled"] }
    ]
  },
  session: {
    ...baselineRecord.session,
    stateLanes: Arr.append(baselineRecord.session.stateLanes, { lane: "retrieval", entries: ["route-memory"] })
  },
  projection: {
    ...baselineRecord.projection,
    terminalNodeIds: ["render-check"],
    activeStateLanes: ["conversation", "retrieval", "render"]
  }
})

export const chatHandoffWorkflowComparison: WorkflowComparison = {
  publication: {
    comparisonId: "workflow-comparison/chat-handoff",
    consumerId: "workflow-comparison"
  },
  authorities: workflowComparisonAuthorityBindings,
  label: "Chat Handoff",
  summary: "Compares a direct chat handoff against a retrieval-and-render aware continuation graph.",
  workflowKind: "chat-continuation",
  records: { baseline: baselineRecord, optimized: optimizedRecord },
  reports: {
    baseline: makeWorkflowEvaluationReport({
      reportId: "chat-handoff-baseline-report",
      workflowKind: "chat-continuation",
      profile: workflowProfileLibrary.chatOriented,
      totalCases: 2,
      aggregateScore: 0.58,
      componentBreakdown: [{
        component: "conversationContinuity",
        rawValue: 0.62,
        normalizedValue: 0.62,
        weight: 0.35,
        weightedValue: 0.217
      }],
      lossSummary: { count: 2, mean: 0.42, minimum: 0.36, maximum: 0.48, variance: 0.0036, standardDeviation: 0.06 },
      caseResults: [
        { caseId: "chat-case-1", score: 0.55, loss: 0.45, components: [] },
        { caseId: "chat-case-2", score: 0.61, loss: 0.39, components: [] }
      ]
    }),
    optimized: makeWorkflowEvaluationReport({
      reportId: "chat-handoff-optimized-report",
      workflowKind: "chat-continuation",
      profile: workflowProfileLibrary.chatOriented,
      totalCases: 2,
      aggregateScore: 0.81,
      componentBreakdown: [{
        component: "conversationContinuity",
        rawValue: 0.88,
        normalizedValue: 0.88,
        weight: 0.35,
        weightedValue: 0.308
      }],
      lossSummary: { count: 2, mean: 0.19, minimum: 0.13, maximum: 0.25, variance: 0.0036, standardDeviation: 0.06 },
      caseResults: [
        { caseId: "chat-case-1", score: 0.79, loss: 0.21, components: [] },
        { caseId: "chat-case-2", score: 0.83, loss: 0.17, components: [] }
      ]
    })
  }
}
