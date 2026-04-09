/**
 * GEPA live optimization for conversational-network protocol design and collective memory.
 *
 * Inspired by PNAS 10.1073/pnas.1525569113, this example optimizes
 * protocol decisions for laboratory-created conversational networks:
 *
 * - clustered vs nonclustered interaction topology
 * - sequencing policy under fixed interaction budgets
 * - expected mnemonic convergence from pre- to post-conversation recall
 *
 * The workflow demonstrates:
 * 1) a teacher-layered dynamics analyst that diagnoses reinforcement,
 *    suppression, and degree-of-separation effects
 * 2) a student protocol planner optimized with GEPA reflective evolution
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Optional env:
 *   DSP_PROVIDER=openai|anthropic|openrouter
 *   DSP_PROVIDER_MODEL=gpt-4o-mini
 *
 * Run: bun run examples/13-gepa-conversational-network-collective-memory.ts
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Layer, Option, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import {
  StandardExampleEvents,
  StandardModuleState,
  StandardExampleSummary,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { liveLanguageModelLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"

const EXAMPLE_NAME = "13-gepa-conversational-network-collective-memory"

/**
 * Labeled optimization cases for GEPA.
 *
 * Inputs encode mechanism-level diagnostics used by the planner to decide:
 * - networkCondition
 * - sequencingPolicy
 * - convergenceForecast
 */
const trainset = Arr.make(
  new Example.Example({
    input: {
      objective: "Maximize whole-network mnemonic convergence after conversational recall.",
      baselineNetwork: "Participants currently interact in highly clustered neighborhoods.",
      dyadicSignal: "Mentioned details are repeatedly reinforced while related unmentioned details are suppressed.",
      degreeProfile: "Memory alignment falls quickly once pairs are more than two links apart.",
      designConstraint: "10 participants, each exactly 3 conversations, 15 total conversations, 150 seconds each.",
      rsProfile: "reinforcement-dominant",
      alignmentReach: "local-only",
      diagnosis:
        "Strong reinforcement with short alignment reach implies clusters trap overlap unless bridge ties are scheduled early."
    },
    output: {
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      convergenceForecast: "high",
      protocolAdjustment:
        "Schedule bridge ties in early rounds so reinforced details propagate before local repetition hardens clusters.",
      rationale:
        "Shorter average path lengths spread reinforced items network-wide and increase post-conversation convergence."
    }
  }),
  new Example.Example({
    input: {
      objective: "Estimate a clean degree-of-separation slope for mnemonic alignment.",
      baselineNetwork: "Investigators need distances that span 1 to 5 links.",
      dyadicSignal: "Reinforcement and suppression effects are present but should remain comparable across rounds.",
      degreeProfile: "Research team wants visible decay in alignment over longer paths.",
      designConstraint: "Keep the same conversation count per participant across all conditions.",
      rsProfile: "balanced",
      alignmentReach: "mixed",
      diagnosis:
        "To preserve inferential contrast, maintain modular structure long enough to keep path-length variance measurable."
    },
    output: {
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      convergenceForecast: "moderate",
      protocolAdjustment:
        "Preserve modular clusters during early rounds to retain longer path distances for inferential contrast.",
      rationale:
        "Clustered topology provides wider separation ranges, making distance-dependent alignment effects easier to measure."
    }
  }),
  new Example.Example({
    input: {
      objective: "Rapidly align collective memory around accurate outbreak guidance.",
      baselineNetwork: "Current structure isolates several subgroups with weak bridge ties.",
      dyadicSignal: "Conversation strongly reinforces mentioned preventive actions.",
      degreeProfile: "Alignment remains local when bridge conversations happen late.",
      designConstraint: "Do not increase participant count or total conversation budget.",
      rsProfile: "reinforcement-dominant",
      alignmentReach: "local-only",
      diagnosis:
        "Local reinforcement dominates but fails to diffuse globally when bridges are delayed in the interaction schedule."
    },
    output: {
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      convergenceForecast: "high",
      protocolAdjustment:
        "Front-load cross-cluster conversations so high-value items become central in the network memory graph.",
      rationale: "Early bridge exposure increases item centrality and accelerates community-wide mnemonic convergence."
    }
  }),
  new Example.Example({
    input: {
      objective: "Compare subgroup narratives while still producing within-group alignment.",
      baselineNetwork: "Two communities should remain partially distinct for causal comparison.",
      dyadicSignal: "Suppression spillover is a risk when conversations repeatedly omit minority details.",
      degreeProfile: "Team wants local convergence but not full network homogenization.",
      designConstraint: "Interaction budget and conversation duration are fixed by protocol ethics review.",
      rsProfile: "suppression-dominant",
      alignmentReach: "mixed",
      diagnosis:
        "Early bridging under suppression pressure can erase minority traces, so preserve subgroup exchanges first."
    },
    output: {
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      convergenceForecast: "moderate",
      protocolAdjustment:
        "Prioritize within-cluster exchanges before any bridge rounds to protect subgroup-specific memory traces.",
      rationale: "Cluster-first ordering supports local alignment while limiting immediate network-wide convergence."
    }
  })
)

/**
 * Held-out evaluation cases used for baseline/optimized comparison.
 */
const evalset = Arr.make(
  new Example.Example({
    input: {
      objective: "Maximize increase in mnemonic convergence from pre- to post-conversation recall.",
      baselineNetwork: "Path lengths are currently long and bridge ties are sparse.",
      dyadicSignal: "High reinforcement for repeated details plus suppression for related unmentioned details.",
      degreeProfile: "Alignment is significant mainly for one- to three-step neighbors.",
      designConstraint: "10 members, 3 conversations each, conversation order can be changed.",
      rsProfile: "reinforcement-dominant",
      alignmentReach: "local-only",
      diagnosis: "Current ordering overweights local loops; reducing effective diameter should improve global overlap."
    },
    output: {
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      convergenceForecast: "high",
      protocolAdjustment: "Reduce effective diameter first, then repeat key items inside local neighborhoods.",
      rationale:
        "Bridge-first scheduling amplifies global spread of reinforced memories under fixed interaction budgets."
    }
  }),
  new Example.Example({
    input: {
      objective: "Test how mnemonic alignment decays by conversational distance.",
      baselineNetwork: "Analysts need broad variation in path lengths for model fitting.",
      dyadicSignal: "Both reinforcement and suppression should be observable without immediate full diffusion.",
      degreeProfile: "Distance bins from one to five links are required.",
      designConstraint: "Conversation count and timing per participant must stay constant.",
      rsProfile: "balanced",
      alignmentReach: "mixed",
      diagnosis: "Maintaining cluster modularity preserves the distance gradient needed for slope estimation."
    },
    output: {
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      convergenceForecast: "moderate",
      protocolAdjustment: "Keep clusters intact through early rounds to preserve measurable distance gradients.",
      rationale: "Clustered structure sustains longer paths, improving identification of degree-of-separation effects."
    }
  }),
  new Example.Example({
    input: {
      objective: "Speed collective memory formation for disaster-response checklists.",
      baselineNetwork: "Teams begin in isolated triads with weak cross-team communication.",
      dyadicSignal: "Reinforcement dominates when checklist items are repeatedly referenced.",
      degreeProfile: "Late bridging delays network-wide alignment.",
      designConstraint: "No additional sessions allowed; only ordering and topology can change.",
      rsProfile: "reinforcement-dominant",
      alignmentReach: "local-only",
      diagnosis:
        "Triad-level reinforcement is strong but stranded; early bridge exposure is required for network-level convergence."
    },
    output: {
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      convergenceForecast: "high",
      protocolAdjustment: "Assign early bridge conversations among triads before repeating content within each triad.",
      rationale: "Early bridging converts local reinforcement into community-level convergence more efficiently."
    }
  })
)

const logExampleStage = (
  stage: string,
  payload: Readonly<Record<string, unknown>>
) =>
  Effect.log("example:13 stage", {
    stage,
    ...payload
  })

const logExampleEvent = (
  optimizer: string,
  line: string
) =>
  Effect.log("example:13 optimizer event", {
    optimizer,
    line
  })

/**
 * Read a string field from dynamic metric payloads.
 */
const readStringField = (record: Readonly<Record<string, unknown>>, field: string): string =>
  Option.getOrElse(
    Option.fromNullable(record[field]).pipe(
      Option.filter((value): value is string => typeof value === "string")
    ),
    () => ""
  )

const normalizeLabel = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll("_", "-")
    .trim()

const normalizeNetworkCondition = (value: string): string => {
  const normalized = normalizeLabel(value)

  if (
    (normalized.includes("non") && normalized.includes("cluster")) ||
    (normalized.includes("single") && normalized.includes("cluster"))
  ) {
    return "nonclustered"
  }

  if (normalized.includes("cluster")) {
    return "clustered"
  }

  return ""
}

const normalizeSequencingPolicy = (value: string): string => {
  const normalized = normalizeLabel(value)

  if (normalized.includes("bridge") || (normalized.includes("cross") && normalized.includes("cluster"))) {
    return "bridge-early"
  }

  if (normalized.includes("cluster") || normalized.includes("within")) {
    return "cluster-first"
  }

  return ""
}

const normalizeConvergenceForecast = (value: string): string => {
  const normalized = normalizeLabel(value)

  if (normalized.includes("high") || normalized.includes("strong")) {
    return "high"
  }

  if (normalized.includes("moderate") || normalized.includes("medium") || normalized.includes("mixed")) {
    return "moderate"
  }

  if (normalized.includes("low") || normalized.includes("weak")) {
    return "low"
  }

  return ""
}

/**
 * Protocol-fit metric with rich feedback for GEPA reflection.
 */
const protocolMetric = Metric.fromEffect("collectiveMemoryProtocolFit", (prediction, expected) =>
  Effect.sync(() => {
    const predictedConditionRaw = readStringField(prediction, "networkCondition")
    const predictedSequenceRaw = readStringField(prediction, "sequencingPolicy")
    const predictedForecastRaw = readStringField(prediction, "convergenceForecast")

    const expectedConditionRaw = readStringField(expected, "networkCondition")
    const expectedSequenceRaw = readStringField(expected, "sequencingPolicy")
    const expectedForecastRaw = readStringField(expected, "convergenceForecast")

    const predictedCondition = normalizeNetworkCondition(predictedConditionRaw)
    const predictedSequence = normalizeSequencingPolicy(predictedSequenceRaw)
    const predictedForecast = normalizeConvergenceForecast(predictedForecastRaw)

    const expectedCondition = normalizeNetworkCondition(expectedConditionRaw)
    const expectedSequence = normalizeSequencingPolicy(expectedSequenceRaw)
    const expectedForecast = normalizeConvergenceForecast(expectedForecastRaw)

    const conditionScore = predictedCondition === expectedCondition ? 1 : 0
    const sequenceScore = predictedSequence === expectedSequence ? 1 : 0
    const forecastScore = predictedForecast === expectedForecast ? 1 : 0
    const score = (conditionScore + sequenceScore + forecastScore) / 3

    const feedback = score === 1
      ? "Protocol decisions match target network method and convergence forecast."
      : `Expected condition '${expectedCondition}' (raw='${expectedConditionRaw}'), sequence '${expectedSequence}' (raw='${expectedSequenceRaw}'), forecast '${expectedForecast}' (raw='${expectedForecastRaw}'), but received '${predictedCondition}' (raw='${predictedConditionRaw}'), '${predictedSequence}' (raw='${predictedSequenceRaw}'), '${predictedForecast}' (raw='${predictedForecastRaw}').`

    return new Metric.Result({ score, feedback })
  }))

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(EXAMPLE_NAME)

  const dynamicsSignature = yield* Signature.make(
    "Diagnose how conversational network structure and dyadic memory dynamics shape collective-memory convergence.",
    {
      objective: Signature.describe(Schema.String, "Experimental objective for collective memory formation"),
      baselineNetwork: Signature.describe(Schema.String, "Current network topology and structure"),
      dyadicSignal: Signature.describe(Schema.String, "Observed reinforcement and suppression dynamics"),
      degreeProfile: Signature.describe(Schema.String, "Observed or desired degree-of-separation alignment profile")
    },
    {
      rsProfile: Signature.describe(
        Schema.String,
        "One label: reinforcement-dominant, suppression-dominant, or balanced"
      ),
      alignmentReach: Signature.describe(
        Schema.String,
        "One label: local-only, mixed, or network-wide"
      ),
      diagnosis: Signature.describe(Schema.String, "Concise mechanism-level diagnosis")
    }
  )

  const plannerSignature = yield* Signature.make(
    "Design the strongest conversational-memory protocol. Return networkCondition as clustered or nonclustered, sequencingPolicy as cluster-first or bridge-early, and convergenceForecast as high, moderate, or low.",
    {
      objective: Signature.describe(Schema.String, "Protocol optimization objective"),
      baselineNetwork: Signature.describe(Schema.String, "Current network structure"),
      dyadicSignal: Signature.describe(Schema.String, "Observed dyadic memory dynamics"),
      degreeProfile: Signature.describe(Schema.String, "Distance-dependent alignment profile"),
      designConstraint: Signature.describe(Schema.String, "Hard methodological constraints"),
      rsProfile: Signature.describe(Schema.String, "Diagnosed reinforcement/suppression profile"),
      alignmentReach: Signature.describe(Schema.String, "Diagnosed alignment reach"),
      diagnosis: Signature.describe(Schema.String, "Mechanism diagnosis summary")
    },
    {
      networkCondition: Signature.describe(
        Schema.String,
        "Chosen topology: clustered or nonclustered"
      ),
      sequencingPolicy: Signature.describe(
        Schema.String,
        "Chosen ordering policy: cluster-first or bridge-early"
      ),
      convergenceForecast: Signature.describe(
        Schema.String,
        "Expected convergence lift: high, moderate, or low"
      ),
      protocolAdjustment: Signature.describe(Schema.String, "Specific design adjustment"),
      rationale: Signature.describe(Schema.String, "Rationale grounded in network and memory dynamics")
    }
  )

  const panelSignature = yield* Signature.make(
    "Synthesize conversational-network dynamics into a collective-memory protocol recommendation.",
    {
      objective: Signature.describe(Schema.String, "Protocol optimization objective"),
      baselineNetwork: Signature.describe(Schema.String, "Current network structure"),
      dyadicSignal: Signature.describe(Schema.String, "Observed dyadic memory dynamics"),
      degreeProfile: Signature.describe(Schema.String, "Distance-dependent alignment profile"),
      designConstraint: Signature.describe(Schema.String, "Hard methodological constraints")
    },
    {
      networkCondition: Signature.describe(
        Schema.String,
        "Chosen topology: clustered or nonclustered"
      ),
      sequencingPolicy: Signature.describe(
        Schema.String,
        "Chosen ordering policy: cluster-first or bridge-early"
      ),
      convergenceForecast: Signature.describe(
        Schema.String,
        "Expected convergence lift: high, moderate, or low"
      ),
      protocolAdjustment: Signature.describe(Schema.String, "Specific design adjustment"),
      rationale: Signature.describe(Schema.String, "Rationale grounded in network and memory dynamics")
    }
  )

  const dynamicsAnalyst = yield* Module.chainOfThought(
    "collective-memory-dynamics-analyst",
    dynamicsSignature
  )
  const protocolPlanner = yield* Module.predict(
    "collective-memory-gepa-planner",
    plannerSignature
  )
  const teacherLayer = liveLanguageModelLayer().pipe(Layer.orDie)

  const protocolPanel = yield* Module.compose({
    name: "collective-memory-gepa-panel",
    signature: panelSignature,
    subModules: {
      dynamicsAnalyst,
      protocolPlanner
    },
    forward: ({ input }) =>
      Effect.gen(function*() {
        const dynamics = yield* dynamicsAnalyst
          .forward({
            objective: input.objective,
            baselineNetwork: input.baselineNetwork,
            dyadicSignal: input.dyadicSignal,
            degreeProfile: input.degreeProfile
          })
          .pipe(Effect.provide(teacherLayer))

        return yield* protocolPlanner.forward({
          objective: input.objective,
          baselineNetwork: input.baselineNetwork,
          dyadicSignal: input.dyadicSignal,
          degreeProfile: input.degreeProfile,
          designConstraint: input.designConstraint,
          rsProfile: dynamics.rsProfile,
          alignmentReach: dynamics.alignmentReach,
          diagnosis: dynamics.diagnosis
        })
      })
  })

  const demonstrationTurn = yield* protocolPanel.forward({
    objective: "Increase network-wide memory overlap after a fixed conversational phase.",
    baselineNetwork: "Current topology is modular with sparse bridges between neighborhoods.",
    dyadicSignal: "Repeatedly mentioned items show reinforcement and omitted related items are suppressed.",
    degreeProfile: "Alignment remains high only for low separation pairs.",
    designConstraint: "Hold participant count and total conversation time constant."
  })

  yield* logExampleStage("panel-demo-turn", {
    networkCondition: demonstrationTurn.networkCondition,
    sequencingPolicy: demonstrationTurn.sequencingPolicy,
    convergenceForecast: demonstrationTurn.convergenceForecast,
    protocolAdjustment: demonstrationTurn.protocolAdjustment
  })

  const plannerParamsBeforeOptimization = yield* Ref.get(protocolPlanner.params)

  yield* logExampleStage("baseline-evaluation-started", {
    evalExampleCount: evalset.length
  })

  const baseline = yield* Evaluate.run({
    module: protocolPlanner,
    examples: evalset,
    metrics: { protocolFit: protocolMetric },
    concurrency: 1
  })

  yield* logExampleStage("gepa-stream-started", {
    trainExampleCount: trainset.length,
    maxIterations: 4,
    maxMergeInvocations: 4,
    seed: 41
  })

  const gepaEventsChunk = yield* Optimizer.gepaStream({
    module: protocolPlanner,
    trainset,
    valset: evalset,
    metric: protocolMetric,
    maxIterations: 4,
    maxMergeInvocations: 4,
    seed: 41
  }).pipe(
    Optimizer.GEPAProgressLine.tap((line) => logExampleEvent("gepa", line.text)),
    Stream.runCollect
  )

  const optimized = yield* Evaluate.run({
    module: protocolPlanner,
    examples: evalset,
    metrics: { protocolFit: protocolMetric },
    concurrency: 1
  })

  const gepaEvents = Arr.fromIterable(gepaEventsChunk)
  const gepaEventSummary = Optimizer.GEPAEventSummary.summarize(gepaEvents)
  const plannerParamsAfterOptimization = yield* Ref.get(protocolPlanner.params)
  const plannerSavedState = yield* Module.save(protocolPlanner)

  const baselineScore = baseline.overallScores.protocolFit ?? 0
  const optimizedScore = optimized.overallScores.protocolFit ?? 0
  const outcomeSummary = Optimizer.GEPAOutcomeSummary.make({
    baselineExactMatch: baselineScore,
    optimizedExactMatch: optimizedScore,
    instructionBeforeOptimization: plannerParamsBeforeOptimization.instructions,
    instructionAfterOptimization: plannerParamsAfterOptimization.instructions,
    eventSummary: gepaEventSummary
  })
  const summaryArtifact = StandardExampleSummary.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "gepa",
    metricName: "collectiveMemoryProtocolFit",
    baselineScore,
    optimizedScore,
    eventCount: gepaEvents.length,
    optimizationSummary: {
      gepa: gepaEventSummary,
      gepaOutcome: outcomeSummary
    },
    seed: 41,
    optimizationConfig: {
      maxIterations: 4,
      maxMergeInvocations: 4,
      seed: 41
    },
    trainsetSize: trainset.length,
    valsetSize: evalset.length,
    evalsetSize: evalset.length,
    instructionBefore: plannerParamsBeforeOptimization.instructions,
    instructionAfter: plannerParamsAfterOptimization.instructions,
    demoCountBefore: plannerParamsBeforeOptimization.demos.length,
    demoCountAfter: plannerParamsAfterOptimization.demos.length,
    demosLearnedDuringOptimization: plannerParamsAfterOptimization.demos.length -
      plannerParamsBeforeOptimization.demos.length,
    extras: {
      baseline,
      optimized,
      demonstrationTurn,
      gepaEventSummary,
      outcomeSummary
    }
  })
  const eventsArtifact = StandardExampleEvents.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "gepa",
    streams: Arr.make({
      name: "gepa",
      events: gepaEvents
    })
  })
  const moduleStateArtifact = StandardModuleState.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "gepa",
    state: plannerSavedState
  })
  const artifactPaths = yield* writeStandardArtifacts({
    artifacts,
    summary: summaryArtifact,
    events: eventsArtifact,
    moduleState: moduleStateArtifact
  }).pipe(Effect.provide(artifacts.envelopeContextLayer))

  yield* logExampleStage("summary", {
    baselineProtocolFit: outcomeSummary.baselineExactMatch,
    optimizedProtocolFit: outcomeSummary.optimizedExactMatch,
    scoreDelta: outcomeSummary.scoreDelta,
    instructionChanged: outcomeSummary.instructionChanged,
    instructionLengthBeforeOptimization: outcomeSummary.instructionLengthBeforeOptimization,
    instructionLengthAfterOptimization: outcomeSummary.instructionLengthAfterOptimization,
    evolvedInstructionPreview: plannerParamsAfterOptimization.instructions.slice(0, 180),
    iterationStartedCount: outcomeSummary.eventSummary.iterationStartedCount,
    mergeCheckedCount: outcomeSummary.eventSummary.mergeCheckedCount,
    mutationProposedCount: outcomeSummary.eventSummary.mutationProposedCount,
    acceptanceEvaluatedCount: outcomeSummary.eventSummary.acceptanceEvaluatedCount,
    acceptanceAcceptedCount: outcomeSummary.eventSummary.acceptanceAcceptedCount,
    gate1PassedCount: outcomeSummary.eventSummary.gate1PassedCount,
    fullValsetEvaluatedCount: outcomeSummary.eventSummary.fullValsetEvaluatedCount,
    iterationWithAcceptedCandidateCount: outcomeSummary.eventSummary.iterationWithAcceptedCandidateCount,
    optimizationCompletedSeen: outcomeSummary.eventSummary.optimizationCompletedSeen,
    optimizationBestCandidateId: outcomeSummary.eventSummary.optimizationBestCandidateId,
    optimizationFrontierSize: outcomeSummary.eventSummary.optimizationFrontierSize,
    maxFrontierSize: outcomeSummary.eventSummary.maxFrontierSize,
    artifactPaths
  })
})

BunRuntime.runMain(
  withLiveLanguageModel(program).pipe(Effect.provide(noopArtifactSinkLayer), Effect.provide(BunContext.layer))
)
