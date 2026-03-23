/**
 * GEPA + effect-search multi-objective direction flows for conversational recall protocols.
 *
 * Experimental inspiration: Coman et al. (PNAS 2016, DOI: 10.1073/pnas.1525569113).
 *
 * This example focuses on one methods slice of the protocol:
 * - 10-member conversational networks
 * - 3 dyadic, turn-taking conversations per participant (150 seconds each)
 * - clustered (C = 0.40) vs nonclustered (C = 0.00) topology decisions
 * - pre/post conversational recall convergence and degree-of-separation effects
 *
 * Workflow:
 * 1) GEPA evolves a multi-agent protocol panel (dynamics analyst -> planner)
 *    on conversational recall method recommendations.
 * 2) effect-search runs two multi-objective direction flows over turn-taking
 *    and sequencing controls to expose trade-offs among convergence,
 *    slope fidelity, and suppression spillover risk.
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Optional env:
 *   DSP_PROVIDER=openai|anthropic|openrouter
 *   DSP_PROVIDER_MODEL=gpt-4o-mini
 *
 * Run: bun run examples/14-gepa-conversational-recall-direction-flows.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Layer, Match, Option, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import { Contracts, SearchSpace, Study } from "effect-search"
import { liveLanguageModelLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"

/**
 * Labeled optimization training cases for GEPA.
 *
 * Each row encodes one conversational-recall protocol problem
 * with the desired methodological decisions:
 * - networkCondition
 * - sequencingPolicy
 * - turnTakingPolicy
 * - convergenceForecast
 */
const trainset = Arr.make(
  new Example.Example({
    input: {
      objective: "Maximize post-conversational mnemonic convergence across all 10 participants.",
      baselineCondition:
        "Participants are arranged in two clustered subgroups (global clustering coefficient C = 0.40).",
      conversationSchedule:
        "Each participant has exactly 3 dyadic, computer-mediated turn-taking conversations, 150 seconds each.",
      turnTakingConstraint: "No participant should dominate more than 60% of turns in any dyad.",
      analysisFocus:
        "Increase convergence from pre- to post-recall while preserving interpretable degree-of-separation effects.",
      protocolConstraint: "Participant count, conversation count, and time budget are fixed by protocol."
    },
    output: {
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      turnTakingPolicy: "strict-alternation",
      convergenceForecast: "high",
      protocolAdjustment:
        "Move bridge ties to round 1 so reinforced items propagate before cluster-local repetition saturates memory overlap.",
      analysisPlan:
        "Estimate pre/post convergence and test pairwise alignment by degree of separation after the three-turn sequence."
    }
  }),
  new Example.Example({
    input: {
      objective: "Estimate a strong linear degree-of-separation alignment gradient.",
      baselineCondition: "Network must preserve long shortest paths for contrast between 1- and 5-step pairs.",
      conversationSchedule: "Three dyadic conversations per participant, but bridge ties can be delayed across rounds.",
      turnTakingConstraint: "Balanced turn-sharing is preferred; strict alternation is optional.",
      analysisFocus: "Prioritize inferential power for alignment slope estimation over maximal global convergence.",
      protocolConstraint: "Keep total interactions identical to the nonclustered condition for comparability."
    },
    output: {
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      turnTakingPolicy: "balanced-free-recall",
      convergenceForecast: "moderate",
      protocolAdjustment:
        "Keep within-cluster conversations first to preserve path-length heterogeneity before any cross-cluster diffusion.",
      analysisPlan:
        "Model dyadic mnemonic alignment as post-pre similarity change and fit separation-sensitive slope terms."
    }
  }),
  new Example.Example({
    input: {
      objective: "Protect minority details from suppression spillover during collaborative recall.",
      baselineCondition:
        "Several details are currently omitted in repeated discussions and then forgotten network-wide.",
      conversationSchedule:
        "Dyads run for fixed 150-second windows; members can still shift who speaks first by round.",
      turnTakingConstraint: "Force low asymmetry in speaking turns to prevent one-sided retrieval cues.",
      analysisFocus:
        "Limit retrieval-induced forgetting while preserving at least moderate convergence gains from conversation.",
      protocolConstraint: "Cannot extend conversation duration or add extra sessions."
    },
    output: {
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      turnTakingPolicy: "strict-alternation",
      convergenceForecast: "low",
      protocolAdjustment:
        "Constrain turn asymmetry and delay bridge diffusion so suppressed traces can be reactivated locally before mixing.",
      analysisPlan:
        "Track reinforcement/suppression item scores and compare spillover risk against baseline conditions."
    }
  }),
  new Example.Example({
    input: {
      objective: "Rapidly synchronize recall for emergency-response guidance across disconnected teams.",
      baselineCondition: "Teams begin in local clusters but must synchronize shared critical items quickly.",
      conversationSchedule: "Members still receive only 3 dyadic conversational turns each, with 150 seconds per turn.",
      turnTakingConstraint: "Bridge participants may lead opening turns if that improves early cross-cluster transfer.",
      analysisFocus: "Optimize bridge diffusion speed without destabilizing post-phase recall quality.",
      protocolConstraint: "No increase in network size or conversation budget."
    },
    output: {
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      turnTakingPolicy: "bridge-speaker-priority",
      convergenceForecast: "high",
      protocolAdjustment:
        "Schedule bridge dyads first and allow bridge nodes to seed shared cues in opening turns before neighborhood repeats.",
      analysisPlan:
        "Compare convergence gains and suppression side effects across topology-matched and topology-mismatched conditions."
    }
  })
)

/**
 * Held-out evaluation cases for baseline vs optimized comparison.
 *
 * Inputs vary target goals (convergence, slope estimation, suppression control)
 * while preserving a stable output contract for protocol scoring.
 */
const evalset = Arr.make(
  new Example.Example({
    input: {
      objective: "Increase network-wide overlap in post-recall under fixed interaction budget.",
      baselineCondition: "Two clusters communicate internally first and currently bridge only in the final round.",
      conversationSchedule: "10 members, 3 dyadic turns each, 150 seconds per turn.",
      turnTakingConstraint: "Avoid turn dominance greater than 55% in any dyad.",
      analysisFocus: "Lift convergence while preserving interpretable dyadic alignment outcomes.",
      protocolConstraint: "Must preserve the same number of interactions across conditions."
    },
    output: {
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      turnTakingPolicy: "strict-alternation",
      convergenceForecast: "high",
      protocolAdjustment:
        "Reduce effective network diameter in round 1, then reinforce key details under balanced alternating turns.",
      analysisPlan: "Compute pre/post convergence and estimate how alignment decays with conversational separation."
    }
  }),
  new Example.Example({
    input: {
      objective: "Quantify separation-sensitive memory alignment with minimal confounds.",
      baselineCondition: "Design requires longer shortest-path contrasts and controlled diffusion.",
      conversationSchedule: "Maintain 3 conversational dyads per participant and fixed 150-second windows.",
      turnTakingConstraint: "Allow flexible but balanced turn exchange.",
      analysisFocus: "Preserve distance gradient while still measuring convergence lift from conversation.",
      protocolConstraint: "No extra rounds and no participant reallocations."
    },
    output: {
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      turnTakingPolicy: "balanced-free-recall",
      convergenceForecast: "moderate",
      protocolAdjustment:
        "Keep modular paths intact in early rounds and delay bridges to preserve degree-of-separation range.",
      analysisPlan: "Evaluate alignment slope by shortest-path distance with condition-level mixed effects."
    }
  }),
  new Example.Example({
    input: {
      objective: "Limit suppression spillover while preserving measurable collective-memory gains.",
      baselineCondition:
        "High reinforcement of discussed items is currently suppressing related non-mentioned details.",
      conversationSchedule: "Dyadic turn-taking remains fixed at 3 rounds and 150 seconds per interaction.",
      turnTakingConstraint: "Strict alternation is encouraged to prevent one-sided retrieval cues.",
      analysisFocus: "Stabilize minority item retention and monitor convergence trade-offs.",
      protocolConstraint: "Protocol timing and participant count are immutable."
    },
    output: {
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      turnTakingPolicy: "strict-alternation",
      convergenceForecast: "low",
      protocolAdjustment:
        "Use locally contained rounds with strict alternation to dampen suppression cascades before bridge propagation.",
      analysisPlan: "Report reinforcement/suppression item scores and compare spillover risk across rounds."
    }
  })
)

/**
 * Deterministic scenario parameters used by the effect-search phase.
 *
 * These scenarios approximate the PNAS-style design envelope and provide
 * target signals for convergence, separation slope fidelity, and suppression pressure.
 */
const conversationalRecallScenarios = Arr.make(
  {
    scenarioId: "pnas-nonclustered-bridge-first",
    participants: 10,
    conversationsPerParticipant: 3,
    conversationSeconds: 150,
    targetCondition: "nonclustered",
    targetSequencing: "bridge-early",
    targetSlope: 0.13,
    suppressionSensitivity: 0.34,
    diameterPressure: 0.15,
    turnRigidityDemand: 0.45
  },
  {
    scenarioId: "pnas-clustered-contrast-estimation",
    participants: 10,
    conversationsPerParticipant: 3,
    conversationSeconds: 150,
    targetCondition: "clustered",
    targetSequencing: "cluster-first",
    targetSlope: 0.22,
    suppressionSensitivity: 0.27,
    diameterPressure: 0.48,
    turnRigidityDemand: 0.35
  },
  {
    scenarioId: "pnas-suppression-guarded-protocol",
    participants: 10,
    conversationsPerParticipant: 3,
    conversationSeconds: 150,
    targetCondition: "clustered",
    targetSequencing: "cluster-first",
    targetSlope: 0.19,
    suppressionSensitivity: 0.43,
    diameterPressure: 0.42,
    turnRigidityDemand: 0.62
  }
)

const logExampleStage = (
  stage: string,
  payload: Readonly<Record<string, unknown>>
) =>
  Effect.log("example:14 stage", {
    stage,
    ...payload
  })

const logExampleEvent = (
  optimizer: string,
  line: string
) =>
  Effect.log("example:14 optimizer event", {
    optimizer,
    line
  })

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
    (normalized.includes("non") && normalized.includes("cluster"))
    || (normalized.includes("single") && normalized.includes("cluster"))
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

const normalizeTurnTakingPolicy = (value: string): string => {
  const normalized = normalizeLabel(value)

  if (normalized.includes("strict") || normalized.includes("alternat")) {
    return "strict-alternation"
  }

  if (normalized.includes("bridge") || normalized.includes("priority")) {
    return "bridge-speaker-priority"
  }

  if (normalized.includes("balanced") || normalized.includes("free")) {
    return "balanced-free-recall"
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
  "during",
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

/**
 * Protocol-fit metric used by GEPA reflective optimization.
 *
 * Scores the core decision tuple and narrative alignment:
 * - condition/topology
 * - sequencing policy
 * - turn-taking policy
 * - convergence forecast
 * - textual adjustment/analysis overlap
 */
const protocolMetric = Metric.fromEffect(
  "conversationalRecallProtocolFit",
  (prediction, expected) =>
    Effect.sync(() => {
      const predictedConditionRaw = readStringField(prediction, "networkCondition")
      const predictedSequencingRaw = readStringField(prediction, "sequencingPolicy")
      const predictedTurnPolicyRaw = readStringField(prediction, "turnTakingPolicy")
      const predictedForecastRaw = readStringField(prediction, "convergenceForecast")
      const predictedAdjustmentRaw = readStringField(prediction, "protocolAdjustment")
      const predictedAnalysisPlanRaw = readStringField(prediction, "analysisPlan")

      const expectedConditionRaw = readStringField(expected, "networkCondition")
      const expectedSequencingRaw = readStringField(expected, "sequencingPolicy")
      const expectedTurnPolicyRaw = readStringField(expected, "turnTakingPolicy")
      const expectedForecastRaw = readStringField(expected, "convergenceForecast")
      const expectedAdjustmentRaw = readStringField(expected, "protocolAdjustment")
      const expectedAnalysisPlanRaw = readStringField(expected, "analysisPlan")

      const predictedCondition = normalizeNetworkCondition(predictedConditionRaw)
      const predictedSequencing = normalizeSequencingPolicy(predictedSequencingRaw)
      const predictedTurnPolicy = normalizeTurnTakingPolicy(predictedTurnPolicyRaw)
      const predictedForecast = normalizeConvergenceForecast(predictedForecastRaw)

      const expectedCondition = normalizeNetworkCondition(expectedConditionRaw)
      const expectedSequencing = normalizeSequencingPolicy(expectedSequencingRaw)
      const expectedTurnPolicy = normalizeTurnTakingPolicy(expectedTurnPolicyRaw)
      const expectedForecast = normalizeConvergenceForecast(expectedForecastRaw)

      const conditionScore = predictedCondition === expectedCondition ? 1 : 0
      const sequencingScore = predictedSequencing === expectedSequencing ? 1 : 0
      const turnPolicyScore = predictedTurnPolicy === expectedTurnPolicy ? 1 : 0
      const forecastScore = predictedForecast === expectedForecast ? 1 : 0
      const narrativeScore = averageScore(
        Arr.make(
          tokenOverlapScore(predictedAdjustmentRaw, expectedAdjustmentRaw),
          tokenOverlapScore(predictedAnalysisPlanRaw, expectedAnalysisPlanRaw)
        )
      )

      const score = clampUnitScore(
        (conditionScore * 0.25)
          + (sequencingScore * 0.25)
          + (turnPolicyScore * 0.2)
          + (forecastScore * 0.15)
          + (narrativeScore * 0.15)
      )

      const mismatchLines = Arr.filter(
        Arr.make(
          conditionScore === 1 ? "" : `networkCondition expected='${expectedCondition}' got='${predictedCondition}'`,
          sequencingScore === 1 ? "" : `sequencingPolicy expected='${expectedSequencing}' got='${predictedSequencing}'`,
          turnPolicyScore === 1 ? "" : `turnTakingPolicy expected='${expectedTurnPolicy}' got='${predictedTurnPolicy}'`,
          forecastScore === 1 ? "" : `convergenceForecast expected='${expectedForecast}' got='${predictedForecast}'`
        ),
        (line) => line.length > 0
      )

      const mismatchSummary = mismatchLines.length > 0
        ? mismatchLines.join("; ")
        : "decisionLabels=aligned"

      const feedback = `condition=${conditionScore.toFixed(2)} `
        + `sequencing=${sequencingScore.toFixed(2)} `
        + `turnPolicy=${turnPolicyScore.toFixed(2)} `
        + `forecast=${forecastScore.toFixed(2)} `
        + `narrative=${narrativeScore.toFixed(2)} `
        + mismatchSummary

      return new Metric.Result({ score, feedback })
    })
)

const program = Effect.gen(function*() {
  // Stage 1 — role signatures for dynamics diagnosis and protocol planning.
  const dynamicsSignature = yield* Signature.make(
    "Diagnose conversational-memory dynamics in a 10-member network recall protocol with fixed dyadic turn budgets.",
    {
      objective: Signature.describe(Schema.String, "Experimental objective for conversational recall"),
      baselineCondition: Signature.describe(Schema.String, "Current topology and clustering profile"),
      conversationSchedule: Signature.describe(Schema.String, "Dyadic interaction schedule and time constraints"),
      turnTakingConstraint: Signature.describe(Schema.String, "Turn-taking and asymmetry constraints"),
      analysisFocus: Signature.describe(Schema.String, "Primary analysis target"),
      protocolConstraint: Signature.describe(Schema.String, "Non-negotiable design constraints")
    },
    {
      rsProfile: Signature.describe(
        Schema.String,
        "One label: reinforcement-dominant, suppression-dominant, or balanced"
      ),
      distanceSignal: Signature.describe(
        Schema.String,
        "One label: local-only, mixed, or network-wide"
      ),
      turnRisk: Signature.describe(
        Schema.String,
        "One label: low, moderate, or high turn-taking asymmetry risk"
      ),
      diagnosis: Signature.describe(Schema.String, "Concise mechanism-level diagnosis")
    }
  )

  const plannerSignature = yield* Signature.make(
    "Design a conversational-recall protocol. Return networkCondition as clustered/nonclustered, sequencingPolicy as cluster-first/bridge-early, and turnTakingPolicy as strict-alternation/balanced-free-recall/bridge-speaker-priority.",
    {
      objective: Signature.describe(Schema.String, "Protocol objective"),
      baselineCondition: Signature.describe(Schema.String, "Current topology and clustering profile"),
      conversationSchedule: Signature.describe(Schema.String, "Dyadic conversation schedule"),
      turnTakingConstraint: Signature.describe(Schema.String, "Turn-taking constraints"),
      analysisFocus: Signature.describe(Schema.String, "Primary analysis target"),
      protocolConstraint: Signature.describe(Schema.String, "Hard protocol constraints"),
      rsProfile: Signature.describe(Schema.String, "Diagnosed reinforcement/suppression profile"),
      distanceSignal: Signature.describe(Schema.String, "Diagnosed alignment reach profile"),
      turnRisk: Signature.describe(Schema.String, "Diagnosed turn asymmetry risk"),
      diagnosis: Signature.describe(Schema.String, "Mechanism diagnosis summary")
    },
    {
      networkCondition: Signature.describe(Schema.String, "Topology decision: clustered or nonclustered"),
      sequencingPolicy: Signature.describe(Schema.String, "Scheduling decision: cluster-first or bridge-early"),
      turnTakingPolicy: Signature.describe(
        Schema.String,
        "Turn-taking policy: strict-alternation, balanced-free-recall, or bridge-speaker-priority"
      ),
      convergenceForecast: Signature.describe(Schema.String, "Expected convergence regime: high/moderate/low"),
      protocolAdjustment: Signature.describe(Schema.String, "Concrete protocol adjustment"),
      analysisPlan: Signature.describe(Schema.String, "Analysis plan linked to convergence and alignment")
    }
  )

  const panelSignature = yield* Signature.make(
    "Synthesize conversational network diagnostics into protocol recommendations for collective-memory experiments.",
    {
      objective: Signature.describe(Schema.String, "Protocol objective"),
      baselineCondition: Signature.describe(Schema.String, "Current topology and clustering profile"),
      conversationSchedule: Signature.describe(Schema.String, "Dyadic conversation schedule"),
      turnTakingConstraint: Signature.describe(Schema.String, "Turn-taking constraints"),
      analysisFocus: Signature.describe(Schema.String, "Primary analysis target"),
      protocolConstraint: Signature.describe(Schema.String, "Hard protocol constraints")
    },
    {
      networkCondition: Signature.describe(Schema.String, "Topology decision: clustered or nonclustered"),
      sequencingPolicy: Signature.describe(Schema.String, "Scheduling decision: cluster-first or bridge-early"),
      turnTakingPolicy: Signature.describe(
        Schema.String,
        "Turn-taking policy: strict-alternation, balanced-free-recall, or bridge-speaker-priority"
      ),
      convergenceForecast: Signature.describe(Schema.String, "Expected convergence regime: high/moderate/low"),
      protocolAdjustment: Signature.describe(Schema.String, "Concrete protocol adjustment"),
      analysisPlan: Signature.describe(Schema.String, "Analysis plan linked to convergence and alignment")
    }
  )

  const dynamicsAnalyst = yield* Module.chainOfThought(
    "example14-conversational-dynamics-analyst",
    dynamicsSignature
  )
  const protocolPlanner = yield* Module.predict(
    "example14-conversational-recall-planner",
    plannerSignature
  )
  const teacherLayer = liveLanguageModelLayer().pipe(Layer.orDie)

  // Stage 2 — compose analyst -> planner into one optimizable panel.
  const methodsPanel = yield* Module.compose({
    name: "example14-conversational-recall-panel",
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
            baselineCondition: input.baselineCondition,
            conversationSchedule: input.conversationSchedule,
            turnTakingConstraint: input.turnTakingConstraint,
            analysisFocus: input.analysisFocus,
            protocolConstraint: input.protocolConstraint
          })
          .pipe(Effect.provide(teacherLayer))

        return yield* protocolPlanner.forward({
          objective: input.objective,
          baselineCondition: input.baselineCondition,
          conversationSchedule: input.conversationSchedule,
          turnTakingConstraint: input.turnTakingConstraint,
          analysisFocus: input.analysisFocus,
          protocolConstraint: input.protocolConstraint,
          rsProfile: dynamics.rsProfile,
          distanceSignal: dynamics.distanceSignal,
          turnRisk: dynamics.turnRisk,
          diagnosis: dynamics.diagnosis
        })
      })
  })

  const demonstrationTurn = yield* methodsPanel.forward({
    objective: "Maximize post-conversational convergence while preserving interpretable distance effects.",
    baselineCondition: "Two clustered subgroups with delayed bridges and high local repetition.",
    conversationSchedule: "10 participants, 3 dyadic turn-taking conversations each, 150 seconds per conversation.",
    turnTakingConstraint: "Prevent unilateral turn dominance and preserve collaborative remembering.",
    analysisFocus: "Estimate convergence lift and degree-of-separation alignment after the conversational phase.",
    protocolConstraint: "Participant count and interaction budget are fixed."
  })

  yield* logExampleStage("panel-demo-turn", {
    networkCondition: demonstrationTurn.networkCondition,
    sequencingPolicy: demonstrationTurn.sequencingPolicy,
    turnTakingPolicy: demonstrationTurn.turnTakingPolicy,
    convergenceForecast: demonstrationTurn.convergenceForecast,
    protocolAdjustment: demonstrationTurn.protocolAdjustment
  })

  const panelParamsBeforeGEPA = yield* Ref.get(methodsPanel.params)

  // Stage 3 — evaluate baseline protocol quality.
  yield* logExampleStage("baseline-evaluation-started", {
    evalExampleCount: evalset.length
  })

  const baseline = yield* Evaluate.run({
    module: methodsPanel,
    examples: evalset,
    metrics: { protocolFit: protocolMetric },
    concurrency: 1
  })

  // Stage 4 — GEPA reflective evolution over planner instructions.
  yield* logExampleStage("gepa-stream-started", {
    trainExampleCount: trainset.length,
    maxIterations: 4,
    maxMergeInvocations: 4,
    seed: 140
  })

  const gepaEventsChunk = yield* Optimizer.gepaStream({
    module: methodsPanel,
    trainset,
    valset: evalset,
    metric: protocolMetric,
    maxIterations: 4,
    maxMergeInvocations: 4,
    seed: 140
  }).pipe(
    Optimizer.tapGEPAProgress((line) => logExampleEvent("gepa", line.text)),
    Stream.runCollect
  )

  const optimized = yield* Evaluate.run({
    module: methodsPanel,
    examples: evalset,
    metrics: { protocolFit: protocolMetric },
    concurrency: 1
  })

  const gepaEvents = Arr.fromIterable(gepaEventsChunk)
  const gepaEventSummary = Optimizer.summarizeGEPAEvents(gepaEvents)
  const panelParamsAfterGEPA = yield* Ref.get(methodsPanel.params)

  const baselineScore = baseline.overallScores.protocolFit ?? 0
  const optimizedScore = optimized.overallScores.protocolFit ?? 0
  const gepaOutcome = Optimizer.summarizeGEPAOutcome({
    baselineExactMatch: baselineScore,
    optimizedExactMatch: optimizedScore,
    instructionBeforeOptimization: panelParamsBeforeGEPA.instructions,
    instructionAfterOptimization: panelParamsAfterGEPA.instructions,
    eventSummary: gepaEventSummary
  })

  yield* logExampleStage("gepa-summary", {
    baselineProtocolFit: gepaOutcome.baselineExactMatch,
    optimizedProtocolFit: gepaOutcome.optimizedExactMatch,
    scoreDelta: gepaOutcome.scoreDelta,
    instructionChanged: gepaOutcome.instructionChanged,
    instructionLengthBeforeOptimization: gepaOutcome.instructionLengthBeforeOptimization,
    instructionLengthAfterOptimization: gepaOutcome.instructionLengthAfterOptimization,
    optimizationBestCandidateId: gepaOutcome.eventSummary.optimizationBestCandidateId,
    optimizationFrontierSize: gepaOutcome.eventSummary.optimizationFrontierSize,
    acceptanceAcceptedCount: gepaOutcome.eventSummary.acceptanceAcceptedCount,
    gate1PassedCount: gepaOutcome.eventSummary.gate1PassedCount
  })

  const protocolPriorTurn = yield* methodsPanel.forward({
    objective: "Constrain suppression spillover while preserving network-level convergence lift.",
    baselineCondition: "Clustered network with delayed bridges and high turn asymmetry in some dyads.",
    conversationSchedule: "Three 150-second dyadic turns per participant in a 10-member community.",
    turnTakingConstraint: "Balance turn allocation while preserving conversational fluency.",
    analysisFocus: "Track convergence change and degree-sensitive alignment from pre to post recall.",
    protocolConstraint: "No additional time budget and no additional participants."
  })

  const priorCondition = normalizeNetworkCondition(protocolPriorTurn.networkCondition)
  const priorSequencing = normalizeSequencingPolicy(protocolPriorTurn.sequencingPolicy)
  const priorTurnPolicy = normalizeTurnTakingPolicy(protocolPriorTurn.turnTakingPolicy)

  yield* logExampleStage("protocol-prior", {
    priorCondition,
    priorSequencing,
    priorTurnPolicy,
    priorForecast: normalizeConvergenceForecast(protocolPriorTurn.convergenceForecast)
  })

  // Stage 5 — define effect-search protocol control space.
  const protocolSpace = yield* SearchSpace.make({
    topology: SearchSpace.categorical(["clustered", "nonclustered"]),
    bridgeRound: SearchSpace.int(1, 3),
    bridgeTieFraction: SearchSpace.float(0.2, 1, { step: 0.1 }),
    turnInequality: SearchSpace.float(0, 0.6, { step: 0.05 }),
    reinforcementWeight: SearchSpace.float(0.2, 1, { step: 0.1 }),
    suppressionGuard: SearchSpace.float(0, 1, { step: 0.1 }),
    recapWindowSeconds: SearchSpace.int(0, 60, { step: 15 })
  })

  /**
   * Deterministic surrogate objective model for conversational-recall dynamics.
   *
   * Computes scenario-averaged projections consumed by multi-objective
   * effect-search direction flows.
   */
  const evaluateProtocolDynamics = (config: SearchSpace.Type<typeof protocolSpace>) => {
    const scenarioScores = Arr.map(conversationalRecallScenarios, (scenario) => {
      const scheduleIntensity = (scenario.conversationsPerParticipant * 60) / scenario.conversationSeconds
      const topologyBase = config.topology === "nonclustered"
        ? 0.48 - (scenario.diameterPressure * 0.08)
        : 0.37 + (scenario.diameterPressure * 0.06)
      const bridgeDiffusion = config.bridgeTieFraction * ((4 - config.bridgeRound) / 3) * 0.24
      const reinforcementGain = config.reinforcementWeight * 0.14
      const recapGain = (config.recapWindowSeconds / 60) * 0.07
      const turnPenalty = config.turnInequality * (0.18 + (scenario.turnRigidityDemand * 0.1))
      const suppressionPenalty = (1 - config.suppressionGuard) * scenario.suppressionSensitivity * 0.2

      const conditionAlignment = config.topology === priorCondition
        ? 0.03
        : -0.02
      const sequencingLabel = config.bridgeRound === 1
        ? "bridge-early"
        : "cluster-first"
      const sequencingAlignment = sequencingLabel === priorSequencing
        ? 0.02
        : -0.01
      const turnPolicyAlignment = Match.value(priorTurnPolicy).pipe(
        Match.when("strict-alternation", () => 0.02 - (config.turnInequality * 0.05)),
        Match.when("balanced-free-recall", () => 0.015 - Math.abs(config.turnInequality - 0.2)),
        Match.when("bridge-speaker-priority", () => 0.01 + (config.bridgeTieFraction * 0.02)),
        Match.orElse(() => 0)
      )

      const convergenceLift = clampUnitScore(
        topologyBase
          + bridgeDiffusion
          + reinforcementGain
          + recapGain
          + conditionAlignment
          + sequencingAlignment
          + turnPolicyAlignment
          + (scheduleIntensity * 0.04)
          - turnPenalty
          - suppressionPenalty
      )

      const realizedSlope = (config.topology === "clustered" ? 0.2 : 0.12)
        + (((config.bridgeRound - 1) / 2) * 0.07)
        + ((1 - config.bridgeTieFraction) * 0.05)
        + (config.turnInequality * 0.05)
      const slopeError = Math.abs(realizedSlope - scenario.targetSlope)

      const turnInequality = clampUnitScore(
        (config.turnInequality * 0.9)
          + (scenario.turnRigidityDemand * 0.1)
      )

      const suppressionRisk = clampUnitScore(
        ((1 - config.suppressionGuard) * 0.58)
          + (config.reinforcementWeight * 0.18)
          + (config.topology === "nonclustered" ? 0.08 : 0.04)
          + (config.bridgeRound === 1 ? 0.05 : 0.02)
          + (scenario.suppressionSensitivity * 0.15)
      )

      const bridgePropagation = clampUnitScore(
        (config.bridgeTieFraction * ((4 - config.bridgeRound) / 3) * 0.55)
          + (config.topology === "nonclustered" ? 0.22 : 0.12)
          + (convergenceLift * 0.2)
          - (suppressionRisk * 0.18)
      )

      return {
        convergenceLift,
        slopeError,
        turnInequality,
        suppressionRisk,
        bridgePropagation
      }
    })

    const sums = Arr.reduce(
      scenarioScores,
      {
        convergenceLift: 0,
        slopeError: 0,
        turnInequality: 0,
        suppressionRisk: 0,
        bridgePropagation: 0
      },
      (acc, score) => ({
        convergenceLift: acc.convergenceLift + score.convergenceLift,
        slopeError: acc.slopeError + score.slopeError,
        turnInequality: acc.turnInequality + score.turnInequality,
        suppressionRisk: acc.suppressionRisk + score.suppressionRisk,
        bridgePropagation: acc.bridgePropagation + score.bridgePropagation
      })
    )

    const scenarioCount = conversationalRecallScenarios.length

    return {
      convergenceLift: sums.convergenceLift / scenarioCount,
      slopeError: sums.slopeError / scenarioCount,
      turnInequality: sums.turnInequality / scenarioCount,
      suppressionRisk: sums.suppressionRisk / scenarioCount,
      bridgePropagation: sums.bridgePropagation / scenarioCount
    }
  }

  // Stage 6 — first direction flow: convergence-priority trade-offs.
  const convergencePriorityDirections: ReadonlyArray<Contracts.Direction> = [
    "maximize",
    "minimize",
    "minimize",
    "minimize"
  ]

  // Stage 7 — second direction flow: bridge-amplification trade-offs.
  const bridgeAmplificationDirections: ReadonlyArray<Contracts.Direction> = [
    "maximize",
    "maximize",
    "minimize"
  ]

  yield* logExampleStage("effect-search-flow-started", {
    flow: "convergence-priority",
    directions: convergencePriorityDirections,
    trials: 48,
    seed: 4401,
    acquisition: "thompson"
  })

  const convergenceFlowResult = yield* Study.optimize({
    space: protocolSpace,
    sampler: Optimizer.effectSearchInterop.makeTpeSampler({
      seed: 4401,
      multivariate: true,
      acquisition: "thompson"
    }),
    directions: convergencePriorityDirections,
    trials: 48,
    concurrency: 2,
    objective: (config) => {
      const scores = evaluateProtocolDynamics(config)
      return Effect.succeed(
        Arr.make(
          scores.convergenceLift,
          scores.slopeError,
          scores.turnInequality,
          scores.suppressionRisk
        )
      )
    }
  })

  const convergenceFlowSummary = Optimizer.effectSearchInterop.resultSummary(convergenceFlowResult)

  yield* Match.value(convergenceFlowResult).pipe(
    Match.tag("MultiObjective", ({ paretoFront, completionReason, trials }) =>
      Effect.gen(function*() {
        const vectors = Arr.filterMap(
          trials,
          (trial) =>
            trial.state._tag === "Completed"
              ? Option.some(Contracts.normalizeObjectiveVector(trial.state.value))
              : Option.none()
        )
        const recomputedFrontierIndices = Optimizer.effectSearchInterop.pareto.nonDominatedIndices(
          vectors,
          convergencePriorityDirections
        )

        yield* logExampleStage("convergence-priority-summary", {
          completionReason,
          trialCount: trials.length,
          paretoFrontierSize: paretoFront.length,
          recomputedFrontierSize: recomputedFrontierIndices.length,
          summaryKind: convergenceFlowSummary.kind,
          summaryParetoCount: convergenceFlowSummary.paretoCount
        })

        yield* Effect.forEach(paretoFront.slice(0, 4), (trial) =>
          Effect.gen(function*() {
            const vector = Contracts.normalizeObjectiveVector(trial.state.value)

            yield* Effect.log("example:14 convergence-priority pareto solution", {
              trialNumber: trial.trialNumber,
              convergenceLift: vector[0]?.toFixed(3),
              degreeSlopeError: vector[1]?.toFixed(3),
              turnInequality: vector[2]?.toFixed(3),
              suppressionRisk: vector[3]?.toFixed(3),
              config: trial.config
            })
          }), { discard: true })
      })),
    Match.tag(
      "SingleObjective",
      ({ completionReason, trials }) =>
        logExampleStage("convergence-priority-unexpected-single-objective", {
          completionReason,
          trialCount: trials.length
        })
    ),
    Match.exhaustive
  )

  yield* logExampleStage("effect-search-flow-started", {
    flow: "bridge-amplification",
    directions: bridgeAmplificationDirections,
    trials: 48,
    seed: 4402,
    acquisition: "pi"
  })

  const bridgeFlowResult = yield* Study.optimize({
    space: protocolSpace,
    sampler: Optimizer.effectSearchInterop.makeTpeSampler({
      seed: 4402,
      multivariate: true,
      acquisition: "pi"
    }),
    directions: bridgeAmplificationDirections,
    trials: 48,
    concurrency: 2,
    objective: (config) => {
      const scores = evaluateProtocolDynamics(config)
      return Effect.succeed(
        Arr.make(
          scores.bridgePropagation,
          scores.convergenceLift,
          scores.suppressionRisk
        )
      )
    }
  })

  const bridgeFlowSummary = Optimizer.effectSearchInterop.resultSummary(bridgeFlowResult)

  yield* Match.value(bridgeFlowResult).pipe(
    Match.tag("MultiObjective", ({ paretoFront, completionReason, trials }) =>
      Effect.gen(function*() {
        const vectors = Arr.filterMap(
          trials,
          (trial) =>
            trial.state._tag === "Completed"
              ? Option.some(Contracts.normalizeObjectiveVector(trial.state.value))
              : Option.none()
        )
        const recomputedFrontierIndices = Optimizer.effectSearchInterop.pareto.nonDominatedIndices(
          vectors,
          bridgeAmplificationDirections
        )

        yield* logExampleStage("bridge-amplification-summary", {
          completionReason,
          trialCount: trials.length,
          paretoFrontierSize: paretoFront.length,
          recomputedFrontierSize: recomputedFrontierIndices.length,
          summaryKind: bridgeFlowSummary.kind,
          summaryParetoCount: bridgeFlowSummary.paretoCount
        })

        yield* Effect.forEach(paretoFront.slice(0, 4), (trial) =>
          Effect.gen(function*() {
            const vector = Contracts.normalizeObjectiveVector(trial.state.value)

            yield* Effect.log("example:14 bridge-amplification pareto solution", {
              trialNumber: trial.trialNumber,
              bridgePropagation: vector[0]?.toFixed(3),
              convergenceLift: vector[1]?.toFixed(3),
              suppressionRisk: vector[2]?.toFixed(3),
              config: trial.config
            })
          }), { discard: true })
      })),
    Match.tag(
      "SingleObjective",
      ({ completionReason, trials }) =>
        logExampleStage("bridge-amplification-unexpected-single-objective", {
          completionReason,
          trialCount: trials.length
        })
    ),
    Match.exhaustive
  )

  const convergenceFlowTopologies = Match.value(convergenceFlowResult).pipe(
    Match.tag("MultiObjective", ({ paretoFront }) => Arr.map(paretoFront, (trial) => trial.config.topology)),
    Match.tag("SingleObjective", ({ bestTrial }) => Arr.make(bestTrial.config.topology)),
    Match.exhaustive
  )

  const bridgeFlowTopologies = Match.value(bridgeFlowResult).pipe(
    Match.tag("MultiObjective", ({ paretoFront }) => Arr.map(paretoFront, (trial) => trial.config.topology)),
    Match.tag("SingleObjective", ({ bestTrial }) => Arr.make(bestTrial.config.topology)),
    Match.exhaustive
  )

  const sharedTopologySignal = Arr.reduce(
    convergenceFlowTopologies,
    0,
    (count, topology) => count + (Arr.contains(bridgeFlowTopologies, topology) ? 1 : 0)
  )

  yield* logExampleStage("final-summary", {
    gepaBaselineProtocolFit: gepaOutcome.baselineExactMatch,
    gepaOptimizedProtocolFit: gepaOutcome.optimizedExactMatch,
    gepaScoreDelta: gepaOutcome.scoreDelta,
    convergenceFlowParetoCount: convergenceFlowSummary.paretoCount,
    bridgeFlowParetoCount: bridgeFlowSummary.paretoCount,
    sharedTopologySignal,
    scenarioCount: conversationalRecallScenarios.length,
    pnasDesignAnchor: "10 participants, 3 dyadic turn-taking conversations, 150 seconds per conversation"
  })
})

BunRuntime.runMain(withLiveLanguageModel(program))
