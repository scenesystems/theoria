import { Array as Arr } from "effect"

import {
  type WorkflowComparison,
  workflowComparisonAuthorityBindings
} from "../../../app/contracts/workflow/comparison.js"
import { makeWorkflowEvaluationReport, makeWorkflowExecutionRecord } from "./decode.js"
import { workflowProfileLibrary } from "./profile-library.js"

const baselineRecord = makeWorkflowExecutionRecord({
  recordId: "task-briefing-baseline",
  workflowKind: "task-first",
  session: {
    sessionId: "task-briefing-session",
    workflowKind: "task-first",
    turns: [{ turnId: "task-turn-1", role: "user", content: "Summarize why the runtime route was selected." }],
    stateLanes: [{ lane: "task", entries: ["runtime-route-summary"] }, { lane: "context", entries: ["concise"] }]
  },
  graph: {
    manifestId: "task-briefing-graph",
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
    edges: [{ edgeId: "task-planner-to-responder", kind: "next", fromNodeId: "planner", toNodeId: "responder" }],
    optimizationKnobs: [
      { key: "instruction-profile", kind: "instruction-profile", choices: ["brief", "stepwise"] },
      { key: "response-length-target", kind: "response-length-target", choices: ["short", "medium"] }
    ]
  },
  projection: {
    manifestId: "task-briefing-graph",
    entryNodeId: "planner",
    terminalNodeIds: ["responder"],
    activeStateLanes: ["task", "conversation"]
  },
  evaluation: {
    workflowKind: "task-first",
    profileId: workflowProfileLibrary.taskOriented.profileId,
    profileFamily: workflowProfileLibrary.taskOriented.profileFamily,
    cases: [
      {
        caseId: "task-case-1",
        prompt: "Explain the route choice in one short paragraph.",
        expectedSignals: ["route family", "resolved runtime"],
        renderCritical: false
      },
      {
        caseId: "task-case-2",
        prompt: "Produce a two-bullet handoff with the chosen runtime and why it won.",
        expectedSignals: ["runtime reason", "handoff shape"],
        renderCritical: false
      }
    ]
  }
})

const optimizedRecord = makeWorkflowExecutionRecord({
  ...baselineRecord,
  recordId: "task-briefing-optimized",
  graph: {
    ...baselineRecord.graph,
    variant: "optimized",
    nodes: Arr.append(baselineRecord.graph.nodes, {
      nodeId: "critic",
      nodeKind: "critic",
      runtimeRole: "critic",
      capabilityRequirements: { textGeneration: true, structuredOutput: "best-effort" },
      inputLanes: ["conversation"],
      outputLane: "conversation",
      loopPolicy: "bounded-critique",
      optimizationKnobRefs: ["critique-pass-budget"]
    }),
    edges: Arr.appendAll(baselineRecord.graph.edges, [
      { edgeId: "task-responder-to-critic", kind: "feedback", fromNodeId: "responder", toNodeId: "critic" },
      { edgeId: "task-critic-to-responder", kind: "feedback", fromNodeId: "critic", toNodeId: "responder" }
    ]),
    optimizationKnobs: Arr.append(baselineRecord.graph.optimizationKnobs, {
      key: "critique-pass-budget",
      kind: "critique-pass-budget",
      choices: ["1", "2"]
    })
  }
})

export const taskBriefingWorkflowComparison: WorkflowComparison = {
  publication: {
    comparisonId: "workflow-comparison/task-briefing",
    consumerId: "workflow-comparison"
  },
  authorities: workflowComparisonAuthorityBindings,
  label: "Task Briefing",
  summary: "Compares a concise task graph against a critique-assisted variant on the same execution cases.",
  workflowKind: "task-first",
  records: { baseline: baselineRecord, optimized: optimizedRecord },
  reports: {
    baseline: makeWorkflowEvaluationReport({
      reportId: "task-briefing-baseline-report",
      workflowKind: "task-first",
      profile: workflowProfileLibrary.taskOriented,
      totalCases: 2,
      aggregateScore: 0.62,
      componentBreakdown: [{
        component: "taskSuccess",
        rawValue: 0.7,
        normalizedValue: 0.7,
        weight: 0.45,
        weightedValue: 0.315
      }],
      lossSummary: { count: 2, mean: 0.38, minimum: 0.28, maximum: 0.48, variance: 0.01, standardDeviation: 0.1 },
      caseResults: [
        { caseId: "task-case-1", score: 0.66, loss: 0.34, components: [] },
        { caseId: "task-case-2", score: 0.58, loss: 0.42, components: [] }
      ]
    }),
    optimized: makeWorkflowEvaluationReport({
      reportId: "task-briefing-optimized-report",
      workflowKind: "task-first",
      profile: workflowProfileLibrary.taskOriented,
      totalCases: 2,
      aggregateScore: 0.84,
      componentBreakdown: [{
        component: "taskSuccess",
        rawValue: 0.9,
        normalizedValue: 0.9,
        weight: 0.45,
        weightedValue: 0.405
      }],
      lossSummary: { count: 2, mean: 0.16, minimum: 0.1, maximum: 0.22, variance: 0.0036, standardDeviation: 0.06 },
      caseResults: [
        { caseId: "task-case-1", score: 0.88, loss: 0.12, components: [] },
        { caseId: "task-case-2", score: 0.8, loss: 0.2, components: [] }
      ]
    })
  }
}
