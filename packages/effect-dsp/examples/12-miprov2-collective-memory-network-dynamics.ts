/**
 * MIPROv2 live optimization for collective-memory experiment design.
 *
 * Inspired by PNAS 10.1073/pnas.1525569113, this example optimizes
 * protocol decisions for laboratory-created conversational networks:
 *
 * - clustered vs nonclustered interaction topology
 * - conversation sequencing policy under fixed interaction budgets
 * - expected mnemonic convergence from pre- to post-conversation recall
 *
 * The panel mirrors the paper's micro→macro framing:
 * 1) a dynamics analyst diagnoses sociocognitive signals (reinforcement,
 *    suppression, degree-of-separation effects), then
 * 2) a protocol planner proposes the strongest experimental method.
 *
 * The composed panel is then optimized with BootstrapFewShot + MIPROv2.
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Optional env:
 *   DSP_PROVIDER=openai|anthropic|openrouter
 *   DSP_PROVIDER_MODEL=gpt-4o-mini
 *
 * Run: bun run examples/12-miprov2-collective-memory-network-dynamics.ts
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Layer, Match, Option, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import {
  StandardExampleEvents,
  StandardExampleSummary,
  StandardModuleState,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { liveLanguageModelLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"

const EXAMPLE_NAME = "12-miprov2-collective-memory-network-dynamics"

/**
 * Labeled optimization training cases.
 *
 * Each row encodes a protocol-design problem and the desired methodological
 * decision tuple:
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
      designConstraint: "10 participants, each exactly 3 conversations, 15 total conversations, 150 seconds each."
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
      designConstraint: "Keep the same conversation count per participant across all conditions."
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
      designConstraint: "Do not increase participant count or total conversation budget."
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
      designConstraint: "Interaction budget and conversation duration are fixed by protocol ethics review."
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
 *
 * These examples intentionally vary objective framing while preserving the
 * same output contract so protocol quality can be scored consistently.
 */
const evalset = Arr.make(
  new Example.Example({
    input: {
      objective: "Maximize increase in mnemonic convergence from pre- to post-conversation recall.",
      baselineNetwork: "Path lengths are currently long and bridge ties are sparse.",
      dyadicSignal: "High reinforcement for repeated details plus suppression for related unmentioned details.",
      degreeProfile: "Alignment is significant mainly for one- to three-step neighbors.",
      designConstraint: "10 members, 3 conversations each, conversation order can be changed."
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
      designConstraint: "Conversation count and timing per participant must stay constant."
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
      designConstraint: "No additional sessions allowed; only ordering and topology can change."
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
  Effect.log("example:12 stage", {
    stage,
    ...payload
  })

const logExampleEvent = (
  optimizer: string,
  line: string
) =>
  Effect.log("example:12 optimizer event", {
    optimizer,
    line
  })

/**
 * Read a string field from dynamic metric payloads.
 *
 * `Metric.fromEffect` receives `Record<string, unknown>` payloads, so we
 * normalize absent/non-string values to an empty string for stable scoring.
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

const STOP_WORDS = Arr.make(
  "about",
  "after",
  "before",
  "between",
  "from",
  "into",
  "that",
  "then",
  "their",
  "there",
  "these",
  "this",
  "when",
  "with"
)

const clampUnitScore = (score: number): number => Math.max(0, Math.min(1, score))

const averageScore = (scores: ReadonlyArray<number>): number =>
  scores.length === 0
    ? 0
    : Arr.reduce(scores, 0, (sum, score) => sum + score) / scores.length

const normalizeNarrative = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim()

const dedupeTokens = (tokens: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.reduce(tokens, Arr.empty<string>(), (deduped, token) =>
    Arr.contains(deduped, token)
      ? deduped
      : Arr.append(deduped, token))

const narrativeTokens = (value: string): ReadonlyArray<string> =>
  dedupeTokens(
    normalizeNarrative(value)
      .split(" ")
      .filter((token) => token.length > 3 && !Arr.contains(STOP_WORDS, token))
  )

const tokenOverlapScore = (predicted: string, expected: string): number => {
  const expectedTokens = narrativeTokens(expected)

  if (expectedTokens.length === 0) {
    return 0
  }

  const predictedTokens = narrativeTokens(predicted)
  const overlapCount = Arr.reduce(
    expectedTokens,
    0,
    (count, token) => count + (Arr.contains(predictedTokens, token) ? 1 : 0)
  )

  return overlapCount / expectedTokens.length
}

const conditionKeywords = (condition: string): ReadonlyArray<string> =>
  Match.value(condition).pipe(
    Match.when("nonclustered", () =>
      Arr.make("bridge", "cross", "path", "diameter", "network", "global", "diffus", "spread")),
    Match.when("clustered", () =>
      Arr.make("cluster", "modular", "within", "local", "distance", "separation", "subgroup")),
    Match.orElse(() =>
      Arr.empty<string>()
    )
  )

const sequenceKeywords = (policy: string): ReadonlyArray<string> =>
  Match.value(policy).pipe(
    Match.when("bridge-early", () => Arr.make("bridge", "cross", "early", "first", "front", "before")),
    Match.when("cluster-first", () => Arr.make("cluster", "within", "local", "first", "before")),
    Match.orElse(() => Arr.empty<string>())
  )

const forecastKeywords = (forecast: string): ReadonlyArray<string> =>
  Match.value(forecast).pipe(
    Match.when("high", () => Arr.make("high", "strong", "network", "global", "rapid", "accelerat")),
    Match.when("moderate", () => Arr.make("moderate", "mixed", "partial", "local", "contrast")),
    Match.when("low", () => Arr.make("low", "weak", "limited", "minimal")),
    Match.orElse(() => Arr.empty<string>())
  )

const containsNarrativeKeyword = (
  narrative: string,
  keywords: ReadonlyArray<string>
): number =>
  keywords.length === 0
    ? 0
    : Arr.some(keywords, (keyword) => narrative.includes(keyword))
    ? 1
    : 0

/**
 * Protocol-fit metric.
 *
 * Scores three high-value methodological choices equally:
 * - topology choice (`networkCondition`)
 * - ordering choice (`sequencingPolicy`)
 * - expected convergence regime (`convergenceForecast`)
 *
 * Returns [0, 1] with textual feedback used by MIPROv2.
 */
const protocolMetric = Metric.fromEffect("collectiveMemoryProtocolFit", (prediction, expected) =>
  Effect.sync(() => {
    const predictedConditionRaw = readStringField(prediction, "networkCondition")
    const predictedSequenceRaw = readStringField(prediction, "sequencingPolicy")
    const predictedForecastRaw = readStringField(prediction, "convergenceForecast")
    const predictedAdjustmentRaw = readStringField(prediction, "protocolAdjustment")
    const predictedRationaleRaw = readStringField(prediction, "rationale")

    const expectedConditionRaw = readStringField(expected, "networkCondition")
    const expectedSequenceRaw = readStringField(expected, "sequencingPolicy")
    const expectedForecastRaw = readStringField(expected, "convergenceForecast")
    const expectedAdjustmentRaw = readStringField(expected, "protocolAdjustment")
    const expectedRationaleRaw = readStringField(expected, "rationale")

    const predictedCondition = normalizeNetworkCondition(predictedConditionRaw)
    const predictedSequence = normalizeSequencingPolicy(predictedSequenceRaw)
    const predictedForecast = normalizeConvergenceForecast(predictedForecastRaw)
    const predictedNarrative = normalizeNarrative(`${predictedAdjustmentRaw} ${predictedRationaleRaw}`)

    const expectedCondition = normalizeNetworkCondition(expectedConditionRaw)
    const expectedSequence = normalizeSequencingPolicy(expectedSequenceRaw)
    const expectedForecast = normalizeConvergenceForecast(expectedForecastRaw)

    const conditionScore = predictedCondition === expectedCondition ? 1 : 0
    const sequenceScore = predictedSequence === expectedSequence ? 1 : 0
    const forecastScore = predictedForecast === expectedForecast ? 1 : 0
    const decisionTupleScore = (conditionScore * 0.4) + (sequenceScore * 0.4) + (forecastScore * 0.2)
    const mechanismSupportScore = averageScore(
      Arr.make(
        containsNarrativeKeyword(predictedNarrative, conditionKeywords(expectedCondition)),
        containsNarrativeKeyword(predictedNarrative, sequenceKeywords(expectedSequence)),
        containsNarrativeKeyword(predictedNarrative, forecastKeywords(expectedForecast))
      )
    )
    const explanationAlignmentScore = averageScore(
      Arr.make(
        tokenOverlapScore(predictedAdjustmentRaw, expectedAdjustmentRaw),
        tokenOverlapScore(predictedRationaleRaw, expectedRationaleRaw)
      )
    )
    const score = clampUnitScore(
      (decisionTupleScore * 0.65) +
        (mechanismSupportScore * 0.2) +
        (explanationAlignmentScore * 0.15)
    )
    const mismatchLines = Arr.filter(
      Arr.make(
        predictedCondition === expectedCondition
          ? ""
          : `networkCondition expected='${expectedCondition}' got='${predictedCondition}'`,
        predictedSequence === expectedSequence
          ? ""
          : `sequencingPolicy expected='${expectedSequence}' got='${predictedSequence}'`,
        predictedForecast === expectedForecast
          ? ""
          : `convergenceForecast expected='${expectedForecast}' got='${predictedForecast}'`
      ),
      (line) => line.length > 0
    )
    const mismatchSummary = mismatchLines.length > 0
      ? mismatchLines.join("; ")
      : "decisionLabels=aligned"
    const feedback = `decisionTuple=${decisionTupleScore.toFixed(2)} ` +
      `mechanismSupport=${mechanismSupportScore.toFixed(2)} ` +
      `explanationAlignment=${explanationAlignmentScore.toFixed(2)} ` +
      mismatchSummary

    return new Metric.Result({ score, feedback })
  }))

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(EXAMPLE_NAME)

  // Stage 1 — role signatures for a two-step analytic pipeline.
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
    "Optimize experimental methods for conversational network dynamics and collective memory outcomes.",
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

  // Stage 2 — module construction.
  // The theorist (teacher-layered) diagnoses memory dynamics;
  // the planner consumes that diagnosis and emits protocol decisions.
  const dynamicsAnalyst = yield* Module.chainOfThought(
    "collective-memory-dynamics-analyst",
    dynamicsSignature
  )
  const protocolPlanner = yield* Module.predict(
    "collective-memory-protocol-planner",
    plannerSignature
  )
  const teacherLayer = liveLanguageModelLayer().pipe(Layer.orDie)

  // Stage 3 — compose analyst -> planner into one optimizable panel.
  const protocolPanel = yield* Module.compose({
    name: "collective-memory-methods-panel",
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
  const paramsBeforeBootstrap = yield* Ref.get(protocolPanel.params)

  // Quick sanity turn before formal evaluation/optimization.
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

  // Stage 4 — baseline evaluation.
  yield* logExampleStage("baseline-evaluation-started", {
    evalExampleCount: evalset.length
  })

  const baseline = yield* Evaluate.run({
    module: protocolPanel,
    examples: evalset,
    metrics: { protocolFit: protocolMetric },
    concurrency: 1
  })

  // Stage 5 — teacher bootstrapping seeds demonstrations.
  yield* logExampleStage("bootstrap-warm-start-started", {
    trainExampleCount: trainset.length,
    maxRounds: 2,
    maxBootstrappedDemos: 3,
    threshold: 2 / 3
  })

  const bootstrapEventsChunk = yield* Optimizer.bootstrapFewShotStream({
    module: protocolPanel,
    trainset,
    metric: protocolMetric,
    maxRounds: 2,
    maxBootstrappedDemos: 3,
    threshold: 2 / 3,
    teacher: teacherLayer,
    fallbackToLabeledFewShot: true,
    fallbackLabeledDemoCount: 3
  }).pipe(
    Optimizer.BootstrapProgressLine.tap((line) => logExampleEvent("bootstrapFewShot", line.text)),
    Stream.runCollect
  )
  const bootstrapEvents = Arr.fromIterable(bootstrapEventsChunk)
  const bootstrapSummary = Optimizer.BootstrapEventSummary.summarize(bootstrapEvents)
  const paramsAfterBootstrap = yield* Ref.get(protocolPanel.params)
  const demosAddedDuringBootstrap = paramsAfterBootstrap.demos.length - paramsBeforeBootstrap.demos.length

  yield* logExampleStage("bootstrap-warm-start-completed", {
    totalEvents: bootstrapSummary.totalEvents,
    roundsStarted: bootstrapSummary.roundsStarted,
    roundsCompleted: bootstrapSummary.roundsCompleted,
    traceAcceptedCount: bootstrapSummary.traceAcceptedCount,
    traceRejectedCount: bootstrapSummary.traceRejectedCount,
    fallbackActivatedSeen: bootstrapSummary.fallbackActivatedSeen,
    fallbackCompletedSeen: bootstrapSummary.fallbackCompletedSeen,
    fallbackUsed: bootstrapSummary.fallbackUsed,
    demoCountBeforeBootstrap: paramsBeforeBootstrap.demos.length,
    demoCountAfterBootstrap: paramsAfterBootstrap.demos.length,
    demosAddedDuringBootstrap,
    totalDemos: bootstrapSummary.totalDemos,
    roundsUsed: bootstrapSummary.roundsUsed
  })

  // Stage 6 — MIPROv2 co-optimizes instructions + demo usage.
  yield* logExampleStage("miprov2-stream-started", {
    numCandidates: 4,
    numInstructions: 4,
    trialBudget: 6,
    seed: 33
  })

  const miproEventsChunk = yield* Optimizer.miprov2Stream({
    module: protocolPanel,
    trainset,
    valset: evalset,
    metric: protocolMetric,
    numCandidates: 4,
    numInstructions: 4,
    trialBudget: 6,
    seed: 33
  }).pipe(
    Optimizer.MIPROv2ProgressLine.tap((line) => logExampleEvent("miprov2", line.text)),
    Stream.runCollect
  )
  const miproEvents = Arr.fromIterable(miproEventsChunk)
  const miproEventSummary = Optimizer.MIPROv2EventSummary.summarize(miproEvents)

  const optimized = yield* Evaluate.run({
    module: protocolPanel,
    examples: evalset,
    metrics: { protocolFit: protocolMetric },
    concurrency: 1
  })

  const optimizedParams = yield* Ref.get(protocolPanel.params)

  const baselineScore = baseline.overallScores.protocolFit ?? 0
  const optimizedScore = optimized.overallScores.protocolFit ?? 0
  const miproOutcome = Optimizer.MIPROv2OutcomeSummary.make({
    baselineExactMatch: baselineScore,
    optimizedExactMatch: optimizedScore,
    demoCountBeforeOptimization: paramsAfterBootstrap.demos.length,
    demoCountAfterOptimization: optimizedParams.demos.length,
    eventSummary: miproEventSummary
  })
  const optimizationObservability = Optimizer.MIPROv2OptimizationObservability.make({
    baselineScore,
    optimizedScore,
    eventSummary: miproEventSummary
  })
  const panelSavedState = yield* Module.save(protocolPanel)
  const summaryArtifact = StandardExampleSummary.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    metricName: "collectiveMemoryProtocolFit",
    baselineScore,
    optimizedScore,
    eventCount: bootstrapEvents.length + miproEvents.length,
    optimizationSummary: {
      bootstrap: bootstrapSummary,
      miprov2: miproEventSummary,
      miproOutcome,
      optimizationObservability
    },
    seed: 33,
    optimizationConfig: {
      bootstrap: {
        maxRounds: 2,
        maxBootstrappedDemos: 3,
        threshold: 2 / 3,
        fallbackToLabeledFewShot: true,
        fallbackLabeledDemoCount: 3
      },
      miprov2: {
        numCandidates: 4,
        numInstructions: 4,
        trialBudget: 6,
        seed: 33
      }
    },
    trainsetSize: trainset.length,
    valsetSize: evalset.length,
    evalsetSize: evalset.length,
    instructionBefore: paramsAfterBootstrap.instructions,
    instructionAfter: optimizedParams.instructions,
    demoCountBefore: paramsAfterBootstrap.demos.length,
    demoCountAfter: optimizedParams.demos.length,
    demosLearnedDuringOptimization: miproOutcome.demosLearnedDuringMIPROv2,
    extras: {
      baseline,
      optimized,
      demonstrationTurn,
      bootstrapSummary,
      miproEventSummary,
      miproOutcome,
      optimizationObservability,
      demosAddedDuringBootstrap
    }
  })
  const eventsArtifact = StandardExampleEvents.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    streams: Arr.make(
      {
        name: "bootstrapFewShot",
        events: bootstrapEvents
      },
      {
        name: "miprov2",
        events: miproEvents
      }
    )
  })
  const moduleStateArtifact = StandardModuleState.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    state: panelSavedState
  })
  const artifactPaths = yield* writeStandardArtifacts({
    artifacts,
    summary: summaryArtifact,
    events: eventsArtifact,
    moduleState: moduleStateArtifact
  }).pipe(Effect.provide(artifacts.envelopeContextLayer))

  yield* logExampleStage("summary", {
    baselineProtocolFit: miproOutcome.baselineExactMatch,
    optimizedProtocolFit: miproOutcome.optimizedExactMatch,
    retainedGain: optimizationObservability.retainedGain,
    searchBestProtocolFit: optimizationObservability.searchBestScore,
    searchGain: optimizationObservability.searchGain,
    retainedVsSearchGap: optimizationObservability.retainedVsSearchGap,
    searchImprovedButRetainedFlat: optimizationObservability.searchImprovedButRetainedFlat,
    demoCountBeforeBootstrap: paramsBeforeBootstrap.demos.length,
    demoCountAfterBootstrap: paramsAfterBootstrap.demos.length,
    demosAddedDuringBootstrap,
    demoCountBeforeMIPROv2: miproOutcome.demoCountBeforeOptimization,
    demoCountAfterMIPROv2: miproOutcome.demoCountAfterOptimization,
    demosLearnedDuringMIPROv2: miproOutcome.demosLearnedDuringMIPROv2,
    bootstrapFallbackUsed: bootstrapSummary.fallbackUsed,
    learnedInstructionPreview: optimizedParams.instructions.slice(0, 180),
    eventCount: miproEventSummary.totalEvents,
    trialEvaluatedCount: miproEventSummary.trialEvaluatedCount,
    fullEvalCompletedCount: miproEventSummary.fullEvalCompletedCount,
    phase3ConfiguredTrials: miproEventSummary.phase3ConfiguredTrials,
    phase3CompletedTrials: miproEventSummary.phase3CompletedTrials,
    phase3BestScoreSeen: miproEventSummary.phase3BestScoreSeen,
    phase3BestScore: miproEventSummary.phase3BestScore,
    phase3CompletedSeen: miproEventSummary.phase3CompletedSeen,
    artifactPaths
  })
})

BunRuntime.runMain(
  withLiveLanguageModel(program).pipe(Effect.provide(noopArtifactSinkLayer), Effect.provide(BunContext.layer))
)
