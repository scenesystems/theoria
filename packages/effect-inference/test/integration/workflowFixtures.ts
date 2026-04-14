export const taskFirstWorkflowRecord = {
  recordId: "workflow-task-1",
  workflowKind: "task-first",
  session: {
    sessionId: "11111111-1111-4111-8111-111111111111",
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

export const renderSensitiveProfile = {
  profileId: "render-balanced",
  profileFamily: "render-sensitive",
  workflowKinds: ["chat-continuation", "render-sensitive"],
  components: [
    "taskSuccess",
    "grounding",
    "conversationContinuity",
    "routeEfficiency",
    "renderFitness",
    "tokenCost",
    "latency"
  ],
  weights: {
    taskSuccess: 0.4,
    grounding: 0.2,
    conversationContinuity: 0.1,
    routeEfficiency: 0.05,
    renderFitness: 0.15,
    tokenCost: 0.05,
    latency: 0.05
  },
  normalization: {
    taskSuccess: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    grounding: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    conversationContinuity: {
      kind: "identity-zero-to-one",
      direction: "higher-is-better",
      minimum: 0,
      maximum: 1
    },
    routeEfficiency: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    renderFitness: {
      kind: "support-profile-tolerance",
      direction: "higher-is-better",
      supportProfileRef: "canvas-monospace",
      fontIdentityRef: "Mono:14:default",
      fontReadinessRevision: "0",
      toleranceRef: "canvas-monospace:0"
    },
    tokenCost: { kind: "budget-inverse", direction: "lower-is-better", budget: 4096, unit: "tokens" },
    latency: { kind: "budget-inverse", direction: "lower-is-better", budget: 1200, unit: "milliseconds" }
  }
}

export const workflowEvaluationReport = {
  reportId: "workflow-report-1",
  workflowKind: "render-sensitive",
  profile: renderSensitiveProfile,
  totalCases: 2,
  aggregateScore: 0.81,
  componentBreakdown: [
    {
      component: "taskSuccess",
      rawValue: 0.9,
      normalizedValue: 0.9,
      weight: 0.4,
      weightedValue: 0.36
    },
    {
      component: "renderFitness",
      rawValue: 0.88,
      normalizedValue: 0.88,
      weight: 0.15,
      weightedValue: 0.132
    },
    {
      component: "tokenCost",
      rawValue: 512,
      normalizedValue: 0.875,
      weight: 0.05,
      weightedValue: 0.04375
    }
  ],
  lossSummary: {
    count: 2,
    mean: 0.19,
    minimum: 0.1,
    maximum: 0.28,
    variance: 0.0081,
    standardDeviation: 0.09
  },
  caseResults: [
    {
      caseId: "case-1",
      score: 0.9,
      loss: 0.1,
      components: [
        {
          component: "taskSuccess",
          rawValue: 1,
          normalizedValue: 1,
          weight: 0.4,
          weightedValue: 0.4
        },
        {
          component: "renderFitness",
          rawValue: 0.93,
          normalizedValue: 0.93,
          weight: 0.15,
          weightedValue: 0.1395
        }
      ]
    },
    {
      caseId: "case-2",
      score: 0.72,
      loss: 0.28,
      components: [
        {
          component: "taskSuccess",
          rawValue: 0.8,
          normalizedValue: 0.8,
          weight: 0.4,
          weightedValue: 0.32
        },
        {
          component: "latency",
          rawValue: 900,
          normalizedValue: 0.25,
          weight: 0.05,
          weightedValue: 0.0125
        }
      ]
    }
  ]
}
