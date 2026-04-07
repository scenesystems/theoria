import { Array as Arr } from "effect"

import { type WorkflowComparison, workflowComparisonAuthorityBindings } from "../../contracts/workflow/comparison.js"
import { makeWorkflowEvaluationReport, makeWorkflowExecutionRecord } from "./decode.js"
import { workflowProfileLibrary } from "./profile-library.js"

const baselineRecord = makeWorkflowExecutionRecord({
  recordId: "render-sensitive-baseline",
  workflowKind: "render-sensitive",
  session: {
    sessionId: "render-sensitive-session",
    workflowKind: "render-sensitive",
    turns: [
      {
        turnId: "render-turn-1",
        role: "user",
        content:
          "Draft a sidebar-ready runtime summary that keeps the remediation sentence above the fold and the route reason visible."
      }
    ],
    stateLanes: [
      { lane: "task", entries: ["runtime-surface-summary"] },
      { lane: "render", entries: ["sidebar", "above-fold-critical"] },
      { lane: "context", entries: ["operator-facing"] }
    ]
  },
  graph: {
    manifestId: "render-sensitive-graph",
    workflowKind: "render-sensitive",
    variant: "baseline",
    nodes: [
      {
        nodeId: "planner",
        nodeKind: "planner",
        runtimeRole: "proposer",
        capabilityRequirements: { textGeneration: true, structuredOutput: "best-effort" },
        inputLanes: ["task", "render", "context"],
        outputLane: "conversation",
        loopPolicy: "single-pass",
        optimizationKnobRefs: ["instruction-profile"]
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
    edges: [{ edgeId: "render-planner-to-reply", kind: "next", fromNodeId: "planner", toNodeId: "reply" }],
    optimizationKnobs: [
      { key: "instruction-profile", kind: "instruction-profile", choices: ["brief", "stepwise"] },
      { key: "surface-profile", kind: "surface-profile", choices: ["sidebar", "full-panel"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["medium", "short"] }
    ]
  },
  projection: {
    manifestId: "render-sensitive-graph",
    entryNodeId: "planner",
    terminalNodeIds: ["reply"],
    activeStateLanes: ["task", "conversation", "render"]
  },
  evaluation: {
    workflowKind: "render-sensitive",
    profileId: workflowProfileLibrary.renderSensitive.profileId,
    profileFamily: workflowProfileLibrary.renderSensitive.profileFamily,
    cases: [
      {
        caseId: "render-case-1",
        prompt: "Return a sidebar-ready summary with the route reason above the fold.",
        expectedSignals: ["route reason", "above the fold", "sidebar"],
        renderCritical: true
      },
      {
        caseId: "render-case-2",
        prompt: "Keep the remediation sentence visible without overflowing the narrow surface.",
        expectedSignals: ["remediation sentence", "visible", "narrow surface"],
        renderCritical: true
      }
    ]
  }
})

const optimizedRecord = makeWorkflowExecutionRecord({
  ...baselineRecord,
  recordId: "render-sensitive-optimized",
  graph: {
    ...baselineRecord.graph,
    variant: "optimized",
    nodes: Arr.appendAll(baselineRecord.graph.nodes, [
      {
        nodeId: "critic",
        nodeKind: "critic",
        runtimeRole: "critic",
        capabilityRequirements: { textGeneration: true, structuredOutput: "best-effort" },
        inputLanes: ["conversation", "render"],
        outputLane: "conversation",
        loopPolicy: "bounded-critique",
        optimizationKnobRefs: ["critique-pass-budget", "critique-node-enabled"]
      },
      {
        nodeId: "render-check",
        nodeKind: "render-evaluator",
        runtimeRole: "evaluator",
        capabilityRequirements: { textGeneration: true },
        inputLanes: ["conversation", "render"],
        outputLane: "render",
        loopPolicy: "bounded-retry",
        optimizationKnobRefs: ["surface-profile", "render-check-enabled"]
      }
    ]),
    edges: [
      { edgeId: "render-planner-to-critic", kind: "feedback", fromNodeId: "planner", toNodeId: "critic" },
      { edgeId: "render-critic-to-reply", kind: "feedback", fromNodeId: "critic", toNodeId: "reply" },
      { edgeId: "render-reply-to-check", kind: "render-check", fromNodeId: "reply", toNodeId: "render-check" }
    ],
    optimizationKnobs: [
      { key: "instruction-profile", kind: "instruction-profile", choices: ["stepwise", "brief"] },
      { key: "critique-pass-budget", kind: "critique-pass-budget", choices: ["2", "1"] },
      { key: "critique-node-enabled", kind: "node-enabled", choices: ["enabled", "disabled"] },
      { key: "render-check-enabled", kind: "node-enabled", choices: ["enabled", "disabled"] },
      { key: "runtime-profile", kind: "runtime-profile", choices: ["preferred", "fastest"] },
      { key: "surface-profile", kind: "surface-profile", choices: ["sidebar", "full-panel"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["short", "medium"] }
    ]
  },
  projection: {
    ...baselineRecord.projection,
    terminalNodeIds: ["render-check"],
    activeStateLanes: ["task", "conversation", "render"]
  }
})

export const renderSensitiveWorkflowComparison: WorkflowComparison = {
  publication: {
    comparisonId: "workflow-comparison/render-sensitive",
    consumerId: "workflow-comparison"
  },
  authorities: workflowComparisonAuthorityBindings,
  label: "Render Sensitive",
  summary:
    "Compares a surface-agnostic reply against a render-aware workflow that can search over critique depth, render checks, and bounded surface policy.",
  workflowKind: "render-sensitive",
  records: { baseline: baselineRecord, optimized: optimizedRecord },
  reports: {
    baseline: makeWorkflowEvaluationReport({
      reportId: "render-sensitive-baseline-report",
      workflowKind: "render-sensitive",
      profile: workflowProfileLibrary.renderSensitive,
      totalCases: 2,
      aggregateScore: 0.56,
      componentBreakdown: [{
        component: "renderFitness",
        rawValue: 0.58,
        normalizedValue: 0.58,
        weight: 0.25,
        weightedValue: 0.145
      }],
      lossSummary: { count: 2, mean: 0.44, minimum: 0.39, maximum: 0.49, variance: 0.0025, standardDeviation: 0.05 },
      caseResults: [
        { caseId: "render-case-1", score: 0.53, loss: 0.47, components: [] },
        { caseId: "render-case-2", score: 0.59, loss: 0.41, components: [] }
      ]
    }),
    optimized: makeWorkflowEvaluationReport({
      reportId: "render-sensitive-optimized-report",
      workflowKind: "render-sensitive",
      profile: workflowProfileLibrary.renderSensitive,
      totalCases: 2,
      aggregateScore: 0.89,
      componentBreakdown: [{
        component: "renderFitness",
        rawValue: 0.93,
        normalizedValue: 0.93,
        weight: 0.25,
        weightedValue: 0.2325
      }],
      lossSummary: { count: 2, mean: 0.11, minimum: 0.08, maximum: 0.14, variance: 0.0009, standardDeviation: 0.03 },
      caseResults: [
        { caseId: "render-case-1", score: 0.87, loss: 0.13, components: [] },
        { caseId: "render-case-2", score: 0.91, loss: 0.09, components: [] }
      ]
    })
  }
}
