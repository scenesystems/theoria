import { BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"

import * as Contracts from "../src/contracts/index.js"

const workflowRecordJson = {
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
    profileFamily: "task-oriented",
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

const workflowReportJson = {
  reportId: "workflow-report-1",
  workflowKind: "task-first",
  profile: {
    profileId: "task-default",
    profileFamily: "task-oriented",
    workflowKinds: ["task-first"],
    components: ["taskSuccess", "grounding", "tokenCost", "latency"],
    weights: {
      taskSuccess: 0.5,
      grounding: 0.3,
      tokenCost: 0.1,
      latency: 0.1
    },
    normalization: {
      taskSuccess: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
      grounding: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
      tokenCost: { kind: "budget-inverse", direction: "lower-is-better", budget: 4096, unit: "tokens" },
      latency: { kind: "budget-inverse", direction: "lower-is-better", budget: 1200, unit: "milliseconds" }
    }
  },
  totalCases: 1,
  aggregateScore: 0.84,
  componentBreakdown: [
    {
      component: "taskSuccess",
      rawValue: 0.92,
      normalizedValue: 0.92,
      weight: 0.5,
      weightedValue: 0.46
    },
    {
      component: "grounding",
      rawValue: 0.86,
      normalizedValue: 0.86,
      weight: 0.3,
      weightedValue: 0.258
    }
  ],
  lossSummary: {
    count: 1,
    mean: 0.16,
    minimum: 0.16,
    maximum: 0.16,
    variance: 0,
    standardDeviation: 0
  },
  caseResults: [
    {
      caseId: "case-task-1",
      score: 0.84,
      loss: 0.16,
      components: [
        {
          component: "taskSuccess",
          rawValue: 0.92,
          normalizedValue: 0.92,
          weight: 0.5,
          weightedValue: 0.46
        },
        {
          component: "grounding",
          rawValue: 0.86,
          normalizedValue: 0.86,
          weight: 0.3,
          weightedValue: 0.258
        }
      ]
    }
  ]
}

export const program = Effect.gen(function*() {
  const record = yield* Schema.decodeUnknown(Contracts.WorkflowExecutionRecordSchema)(
    workflowRecordJson
  )
  const report = yield* Schema.decodeUnknown(
    Contracts.WorkflowEvaluationReportSchema
  )(workflowReportJson)

  yield* Effect.log({
    workflowKind: record.workflowKind,
    entryNodeId: record.projection.entryNodeId,
    caseCount: report.totalCases,
    aggregateScore: report.aggregateScore,
    primaryComponent: report.componentBreakdown[0]?.component
  })
})

if (import.meta.main) {
  BunRuntime.runMain(program)
}
