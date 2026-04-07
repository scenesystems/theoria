import { Array as Arr } from "effect"

import { type WorkflowComparison, workflowComparisonAuthorityBindings } from "../../contracts/workflow/comparison.js"
import { makeWorkflowEvaluationReport, makeWorkflowExecutionRecord } from "./decode.js"
import { workflowProfileLibrary } from "./profile-library.js"

const baselineRecord = makeWorkflowExecutionRecord({
  recordId: "retrieval-required-baseline",
  workflowKind: "retrieval-required",
  session: {
    sessionId: "retrieval-required-session",
    workflowKind: "retrieval-required",
    turns: [
      {
        turnId: "retrieval-turn-1",
        role: "user",
        content: "Explain the selected runtime route and cite the supporting evidence that made it win."
      }
    ],
    stateLanes: [
      { lane: "task", entries: ["runtime-route-brief"] },
      { lane: "context", entries: ["grounding-required"] }
    ]
  },
  graph: {
    manifestId: "retrieval-required-graph",
    workflowKind: "retrieval-required",
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
        nodeId: "reply",
        nodeKind: "responder",
        runtimeRole: "task",
        capabilityRequirements: { textGeneration: true, streaming: true },
        inputLanes: ["conversation"],
        outputLane: "conversation",
        loopPolicy: "single-pass",
        optimizationKnobRefs: ["response-length-target"]
      }
    ],
    edges: [{ edgeId: "retrieval-planner-to-reply", kind: "next", fromNodeId: "planner", toNodeId: "reply" }],
    optimizationKnobs: [
      { key: "instruction-profile", kind: "instruction-profile", choices: ["brief", "stepwise"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["short", "medium"] }
    ]
  },
  projection: {
    manifestId: "retrieval-required-graph",
    entryNodeId: "planner",
    terminalNodeIds: ["reply"],
    activeStateLanes: ["task", "conversation"]
  },
  evaluation: {
    workflowKind: "retrieval-required",
    profileId: workflowProfileLibrary.retrievalOriented.profileId,
    profileFamily: workflowProfileLibrary.retrievalOriented.profileFamily,
    cases: [
      {
        caseId: "retrieval-case-1",
        prompt: "Explain the chosen route and cite the supporting evidence in one compact paragraph.",
        expectedSignals: ["route reason", "supporting evidence", "grounding"],
        renderCritical: false
      },
      {
        caseId: "retrieval-case-2",
        prompt: "Return a briefing that names the runtime decision and the retrieved clue that justified it.",
        expectedSignals: ["runtime decision", "retrieved clue"],
        renderCritical: false
      }
    ]
  }
})

const optimizedRecord = makeWorkflowExecutionRecord({
  ...baselineRecord,
  recordId: "retrieval-required-optimized",
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
        optimizationKnobRefs: ["retrieval-depth"]
      },
      {
        nodeId: "critic",
        nodeKind: "critic",
        runtimeRole: "critic",
        capabilityRequirements: { textGeneration: true, structuredOutput: "best-effort" },
        inputLanes: ["conversation", "retrieval"],
        outputLane: "conversation",
        loopPolicy: "bounded-critique",
        optimizationKnobRefs: ["critique-node-enabled"]
      }
    ]),
    edges: [
      { edgeId: "retrieval-planner-to-retrieval", kind: "retrieval", fromNodeId: "planner", toNodeId: "retrieval" },
      { edgeId: "retrieval-retrieval-to-critic", kind: "feedback", fromNodeId: "retrieval", toNodeId: "critic" },
      { edgeId: "retrieval-critic-to-reply", kind: "feedback", fromNodeId: "critic", toNodeId: "reply" }
    ],
    optimizationKnobs: [
      { key: "instruction-profile", kind: "instruction-profile", choices: ["stepwise", "brief"] },
      { key: "retrieval-depth", kind: "retrieval-depth", choices: ["3", "1", "5"] },
      { key: "critique-node-enabled", kind: "node-enabled", choices: ["enabled", "disabled"] },
      { key: "runtime-profile", kind: "runtime-profile", choices: ["preferred", "fastest"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["medium", "short"] }
    ]
  },
  session: {
    ...baselineRecord.session,
    stateLanes: Arr.append(baselineRecord.session.stateLanes, {
      lane: "retrieval",
      entries: ["route-memory", "winner-evidence"]
    })
  },
  projection: {
    ...baselineRecord.projection,
    activeStateLanes: ["task", "conversation", "retrieval"]
  }
})

export const retrievalRequiredWorkflowComparison: WorkflowComparison = {
  publication: {
    comparisonId: "workflow-comparison/retrieval-required",
    consumerId: "workflow-comparison"
  },
  authorities: workflowComparisonAuthorityBindings,
  label: "Retrieval Required",
  summary:
    "Compares an ungrounded route summary against a retrieval-backed workflow that can search over evidence depth and bounded critique topology.",
  workflowKind: "retrieval-required",
  records: { baseline: baselineRecord, optimized: optimizedRecord },
  reports: {
    baseline: makeWorkflowEvaluationReport({
      reportId: "retrieval-required-baseline-report",
      workflowKind: "retrieval-required",
      profile: workflowProfileLibrary.retrievalOriented,
      totalCases: 2,
      aggregateScore: 0.59,
      componentBreakdown: [{
        component: "grounding",
        rawValue: 0.61,
        normalizedValue: 0.61,
        weight: 0.3,
        weightedValue: 0.183
      }],
      lossSummary: { count: 2, mean: 0.41, minimum: 0.35, maximum: 0.47, variance: 0.0036, standardDeviation: 0.06 },
      caseResults: [
        { caseId: "retrieval-case-1", score: 0.56, loss: 0.44, components: [] },
        { caseId: "retrieval-case-2", score: 0.62, loss: 0.38, components: [] }
      ]
    }),
    optimized: makeWorkflowEvaluationReport({
      reportId: "retrieval-required-optimized-report",
      workflowKind: "retrieval-required",
      profile: workflowProfileLibrary.retrievalOriented,
      totalCases: 2,
      aggregateScore: 0.87,
      componentBreakdown: [{
        component: "grounding",
        rawValue: 0.91,
        normalizedValue: 0.91,
        weight: 0.3,
        weightedValue: 0.273
      }],
      lossSummary: { count: 2, mean: 0.13, minimum: 0.08, maximum: 0.18, variance: 0.0025, standardDeviation: 0.05 },
      caseResults: [
        { caseId: "retrieval-case-1", score: 0.84, loss: 0.16, components: [] },
        { caseId: "retrieval-case-2", score: 0.9, loss: 0.1, components: [] }
      ]
    })
  }
}
