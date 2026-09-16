/**
 * Optimizes a live protocol panel with GEPA, then runs two multi-objective
 * searches over topology, sequencing, and turn-taking controls. The Pareto fronts
 * retain convergence, network-distance slope, and suppression-risk trade-offs.
 *
 * Experimental context: PNAS DOI 10.1073/pnas.1525569113.
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
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "@scenesystems/effect-dsp"
import type { FieldRecord } from "@scenesystems/effect-dsp/contracts"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Direction from "@scenesystems/effect-search/Direction"
import * as Objective from "@scenesystems/effect-search/Objective"
import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import * as Study from "@scenesystems/effect-search/Study"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Equal,
  Match,
  Number as Num,
  Option,
  Predicate,
  Record,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"
import { liveTeacherLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"

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
  payload: FieldRecord
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

const readStringField = (record: FieldRecord, field: string): string =>
  Option.getOrElse(
    Record.get(record, field).pipe(Option.filter(Predicate.isString)),
    () => ""
  )

const normalizeLabel = (value: string): string => Str.trim(Str.replaceAll("_", "-")(Str.toLowerCase(value)))

const normalizeNetworkCondition = (value: string): string => {
  const normalized = normalizeLabel(value)

  return Match.value(normalized).pipe(
    Match.when(
      (label) =>
        Bool.or(
          Bool.and(Str.includes("non")(label), Str.includes("cluster")(label)),
          Bool.and(Str.includes("single")(label), Str.includes("cluster")(label))
        ),
      () => "nonclustered"
    ),
    Match.when(Str.includes("cluster"), () => "clustered"),
    Match.orElse(() => "")
  )
}

const normalizeSequencingPolicy = (value: string): string => {
  const normalized = normalizeLabel(value)

  return Match.value(normalized).pipe(
    Match.when(
      (label) =>
        Bool.or(
          Str.includes("bridge")(label),
          Bool.and(Str.includes("cross")(label), Str.includes("cluster")(label))
        ),
      () => "bridge-early"
    ),
    Match.when(
      (label) => Bool.or(Str.includes("cluster")(label), Str.includes("within")(label)),
      () => "cluster-first"
    ),
    Match.orElse(() => "")
  )
}

const normalizeTurnTakingPolicy = (value: string): string => {
  const normalized = normalizeLabel(value)

  return Match.value(normalized).pipe(
    Match.when(
      (label) => Bool.or(Str.includes("strict")(label), Str.includes("alternat")(label)),
      () => "strict-alternation"
    ),
    Match.when(
      (label) => Bool.or(Str.includes("bridge")(label), Str.includes("priority")(label)),
      () => "bridge-speaker-priority"
    ),
    Match.when(
      (label) => Bool.or(Str.includes("balanced")(label), Str.includes("free")(label)),
      () => "balanced-free-recall"
    ),
    Match.orElse(() => "")
  )
}

const normalizeConvergenceForecast = (value: string): string => {
  const normalized = normalizeLabel(value)

  return Match.value(normalized).pipe(
    Match.when(
      (label) => Bool.or(Str.includes("high")(label), Str.includes("strong")(label)),
      () => "high"
    ),
    Match.when(
      (label) =>
        Bool.or(
          Bool.or(Str.includes("moderate")(label), Str.includes("medium")(label)),
          Str.includes("mixed")(label)
        ),
      () => "moderate"
    ),
    Match.when(
      (label) => Bool.or(Str.includes("low")(label), Str.includes("weak")(label)),
      () => "low"
    ),
    Match.orElse(() => "")
  )
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

const clampUnitScore = (score: number): number => Numeric.clamp(score, { minimum: 0, maximum: 1 })

const averageScore = (scores: Iterable<number>): number => {
  const values = Arr.fromIterable(scores)
  return Match.value(Arr.isEmptyReadonlyArray(values)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() => Num.unsafeDivide(Arr.reduce(values, 0, Num.sum), Arr.length(values)))
  )
}

const normalizeNarrative = (value: string): string => Str.trim(Str.replace(/[^a-z0-9]+/g, " ")(Str.toLowerCase(value)))

const dedupeTokens = (tokens: Iterable<string>) =>
  Arr.reduce(tokens, Arr.empty<string>(), (deduped, token) =>
    Bool.match(Arr.contains(deduped, token), {
      onTrue: () => deduped,
      onFalse: () => Arr.append(deduped, token)
    }))

const narrativeTokens = (value: string) =>
  dedupeTokens(
    Arr.filter(
      Str.split(normalizeNarrative(value), " "),
      (token) => Bool.and(Num.greaterThan(Str.length(token), 3), Bool.not(Arr.contains(STOP_WORDS, token)))
    )
  )

const tokenOverlapScore = (predicted: string, expected: string): number => {
  const expectedTokens = narrativeTokens(expected)

  return Match.value(Arr.isEmptyReadonlyArray(expectedTokens)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() => {
      const predictedTokens = narrativeTokens(predicted)
      const overlapCount = Arr.reduce(
        expectedTokens,
        0,
        (count, token) =>
          Bool.match(Arr.contains(predictedTokens, token), {
            onTrue: () => Num.increment(count),
            onFalse: () => count
          })
      )

      return Num.unsafeDivide(overlapCount, Arr.length(expectedTokens))
    })
  )
}

const numberText = Schema.encodeSync(Schema.NumberFromString)

const exactScore = (left: string, right: string): number =>
  Bool.match(Equal.equals(left, right), { onTrue: () => 1, onFalse: () => 0 })

const mismatchLine = (score: number, label: string, expected: string, predicted: string): string =>
  Match.value(score).pipe(
    Match.when(1, () => ""),
    Match.orElse(() => `${label} expected='${expected}' got='${predicted}'`)
  )

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

      const conditionScore = exactScore(predictedCondition, expectedCondition)
      const sequencingScore = exactScore(predictedSequencing, expectedSequencing)
      const turnPolicyScore = exactScore(predictedTurnPolicy, expectedTurnPolicy)
      const forecastScore = exactScore(predictedForecast, expectedForecast)
      const narrativeScore = averageScore(
        Arr.make(
          tokenOverlapScore(predictedAdjustmentRaw, expectedAdjustmentRaw),
          tokenOverlapScore(predictedAnalysisPlanRaw, expectedAnalysisPlanRaw)
        )
      )

      const score = clampUnitScore(
        Numeric.sum(Arr.make(
          Num.multiply(conditionScore, 0.25),
          Num.multiply(sequencingScore, 0.25),
          Num.multiply(turnPolicyScore, 0.2),
          Num.multiply(forecastScore, 0.15),
          Num.multiply(narrativeScore, 0.15)
        ))
      )

      const mismatchLines = Arr.filter(
        Arr.make(
          mismatchLine(conditionScore, "networkCondition", expectedCondition, predictedCondition),
          mismatchLine(sequencingScore, "sequencingPolicy", expectedSequencing, predictedSequencing),
          mismatchLine(turnPolicyScore, "turnTakingPolicy", expectedTurnPolicy, predictedTurnPolicy),
          mismatchLine(forecastScore, "convergenceForecast", expectedForecast, predictedForecast)
        ),
        Str.isNonEmpty
      )

      const mismatchSummary = Match.value(Arr.isNonEmptyReadonlyArray(mismatchLines)).pipe(
        Match.when(true, () => Arr.join(mismatchLines, "; ")),
        Match.orElse(() => "decisionLabels=aligned")
      )

      const feedback = Arr.join(
        Arr.make(
          `condition=${numberText(conditionScore)}`,
          `sequencing=${numberText(sequencingScore)}`,
          `turnPolicy=${numberText(turnPolicyScore)}`,
          `forecast=${numberText(forecastScore)}`,
          `narrative=${numberText(narrativeScore)}`,
          mismatchSummary
        ),
        " "
      )

      return new Metric.Result({ score, feedback })
    })
)

const program = Effect.gen(function*() {
  // Define signatures for dynamics diagnosis and protocol planning.
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
  const teacherLayer = yield* liveTeacherLayer()

  // Compose the analyst and planner into one optimizable panel.
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

  // Evaluate baseline protocol quality.
  yield* logExampleStage("baseline-evaluation-started", {
    evalExampleCount: Arr.length(evalset)
  })

  const baseline = yield* Evaluate.run({
    module: methodsPanel,
    examples: evalset,
    metrics: { protocolFit: protocolMetric },
    concurrency: 1
  })

  // Evolve planner instructions with GEPA.
  yield* logExampleStage("gepa-stream-started", {
    trainExampleCount: Arr.length(trainset),
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

  // Define the protocol control space.
  const protocolSpace = yield* SearchSpace.make({
    topology: SearchSpace.categorical(Arr.make("clustered", "nonclustered")),
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
      const scheduleIntensity = Num.unsafeDivide(
        Num.multiply(scenario.conversationsPerParticipant, 60),
        scenario.conversationSeconds
      )
      const topologyBase = Bool.match(Equal.equals(config.topology, "nonclustered"), {
        onTrue: () => Num.subtract(0.48, Num.multiply(scenario.diameterPressure, 0.08)),
        onFalse: () => Num.sum(0.37, Num.multiply(scenario.diameterPressure, 0.06))
      })
      const bridgeRoundFactor = Num.unsafeDivide(Num.subtract(4, config.bridgeRound), 3)
      const bridgeDiffusion = Num.multiply(Num.multiply(config.bridgeTieFraction, bridgeRoundFactor), 0.24)
      const reinforcementGain = Num.multiply(config.reinforcementWeight, 0.14)
      const recapGain = Num.multiply(Num.unsafeDivide(config.recapWindowSeconds, 60), 0.07)
      const turnPenalty = Num.multiply(
        config.turnInequality,
        Num.sum(0.18, Num.multiply(scenario.turnRigidityDemand, 0.1))
      )
      const suppressionPenalty = Num.multiply(
        Num.multiply(Num.subtract(1, config.suppressionGuard), scenario.suppressionSensitivity),
        0.2
      )

      const conditionAlignment = Bool.match(Equal.equals(config.topology, priorCondition), {
        onTrue: () => 0.03,
        onFalse: () => Num.negate(0.02)
      })
      const sequencingLabel = Bool.match(Num.Equivalence(config.bridgeRound, 1), {
        onTrue: () => "bridge-early",
        onFalse: () => "cluster-first"
      })
      const sequencingAlignment = Bool.match(Equal.equals(sequencingLabel, priorSequencing), {
        onTrue: () => 0.02,
        onFalse: () => Num.negate(0.01)
      })
      const turnPolicyAlignment = Match.value(priorTurnPolicy).pipe(
        Match.when("strict-alternation", () => Num.subtract(0.02, Num.multiply(config.turnInequality, 0.05))),
        Match.when(
          "balanced-free-recall",
          () => Num.subtract(0.015, Numeric.abs(Num.subtract(config.turnInequality, 0.2)))
        ),
        Match.when("bridge-speaker-priority", () => Num.sum(0.01, Num.multiply(config.bridgeTieFraction, 0.02))),
        Match.orElse(() => 0)
      )

      const convergenceLift = clampUnitScore(
        Num.subtract(
          Num.subtract(
            Numeric.sum(Arr.make(
              topologyBase,
              bridgeDiffusion,
              reinforcementGain,
              recapGain,
              conditionAlignment,
              sequencingAlignment,
              turnPolicyAlignment,
              Num.multiply(scheduleIntensity, 0.04)
            )),
            turnPenalty
          ),
          suppressionPenalty
        )
      )

      const realizedSlope = Numeric.sum(Arr.make(
        Bool.match(Equal.equals(config.topology, "clustered"), { onTrue: () => 0.2, onFalse: () => 0.12 }),
        Num.multiply(Num.unsafeDivide(Num.subtract(config.bridgeRound, 1), 2), 0.07),
        Num.multiply(Num.subtract(1, config.bridgeTieFraction), 0.05),
        Num.multiply(config.turnInequality, 0.05)
      ))
      const slopeError = Numeric.abs(Num.subtract(realizedSlope, scenario.targetSlope))

      const turnInequality = clampUnitScore(
        Num.sum(
          Num.multiply(config.turnInequality, 0.9),
          Num.multiply(scenario.turnRigidityDemand, 0.1)
        )
      )

      const suppressionRisk = clampUnitScore(
        Numeric.sum(Arr.make(
          Num.multiply(Num.subtract(1, config.suppressionGuard), 0.58),
          Num.multiply(config.reinforcementWeight, 0.18),
          Bool.match(Equal.equals(config.topology, "nonclustered"), { onTrue: () => 0.08, onFalse: () => 0.04 }),
          Bool.match(Num.Equivalence(config.bridgeRound, 1), { onTrue: () => 0.05, onFalse: () => 0.02 }),
          Num.multiply(scenario.suppressionSensitivity, 0.15)
        ))
      )

      const bridgePropagation = clampUnitScore(
        Num.subtract(
          Numeric.sum(Arr.make(
            Num.multiply(Num.multiply(config.bridgeTieFraction, bridgeRoundFactor), 0.55),
            Bool.match(Equal.equals(config.topology, "nonclustered"), {
              onTrue: () => 0.22,
              onFalse: () => 0.12
            }),
            Num.multiply(convergenceLift, 0.2)
          )),
          Num.multiply(suppressionRisk, 0.18)
        )
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
        convergenceLift: Num.sum(acc.convergenceLift, score.convergenceLift),
        slopeError: Num.sum(acc.slopeError, score.slopeError),
        turnInequality: Num.sum(acc.turnInequality, score.turnInequality),
        suppressionRisk: Num.sum(acc.suppressionRisk, score.suppressionRisk),
        bridgePropagation: Num.sum(acc.bridgePropagation, score.bridgePropagation)
      })
    )

    const scenarioCount = Arr.length(conversationalRecallScenarios)

    return {
      convergenceLift: Num.unsafeDivide(sums.convergenceLift, scenarioCount),
      slopeError: Num.unsafeDivide(sums.slopeError, scenarioCount),
      turnInequality: Num.unsafeDivide(sums.turnInequality, scenarioCount),
      suppressionRisk: Num.unsafeDivide(sums.suppressionRisk, scenarioCount),
      bridgePropagation: Num.unsafeDivide(sums.bridgePropagation, scenarioCount)
    }
  }

  // Run the convergence-priority direction flow.
  const convergencePriorityDirections = yield* Schema.decodeUnknown(Schema.Array(Direction.Direction))(
    Arr.make("maximize", "minimize", "minimize", "minimize")
  )

  // Run the bridge-amplification direction flow.
  const bridgeAmplificationDirections = yield* Schema.decodeUnknown(Schema.Array(Direction.Direction))(
    Arr.make("maximize", "maximize", "minimize")
  )

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
        const completedTrials = Arr.fromIterable(paretoFront)
        const allTrials = Arr.fromIterable(trials)
        const vectors = Arr.filterMap(
          allTrials,
          (trial) =>
            Match.value(trial.state).pipe(
              Match.tag("Completed", ({ value }) => Option.some(Objective.toVector(value))),
              Match.orElse(() => Option.none())
            )
        )
        const recomputedFrontierIndices = Optimizer.effectSearchInterop.pareto.nonDominatedIndices(
          vectors,
          convergencePriorityDirections
        )

        yield* logExampleStage("convergence-priority-summary", {
          completionReason,
          trialCount: Arr.length(allTrials),
          paretoFrontierSize: Arr.length(completedTrials),
          recomputedFrontierSize: Arr.length(recomputedFrontierIndices),
          summaryKind: convergenceFlowSummary.kind,
          summaryParetoCount: convergenceFlowSummary.paretoCount
        })

        yield* Effect.forEach(Arr.take(completedTrials, 4), (trial) =>
          Effect.gen(function*() {
            const vector = Objective.toVector(trial.state.value)

            yield* Effect.log("example:14 convergence-priority pareto solution", {
              trialNumber: trial.trialNumber,
              convergenceLift: Arr.get(vector, 0),
              degreeSlopeError: Arr.get(vector, 1),
              turnInequality: Arr.get(vector, 2),
              suppressionRisk: Arr.get(vector, 3),
              config: trial.config
            })
          }), { discard: true })
      })),
    Match.tag(
      "SingleObjective",
      ({ completionReason, trials }) =>
        logExampleStage("convergence-priority-unexpected-single-objective", {
          completionReason,
          trialCount: Arr.length(Arr.fromIterable(trials))
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
        const completedTrials = Arr.fromIterable(paretoFront)
        const allTrials = Arr.fromIterable(trials)
        const vectors = Arr.filterMap(
          allTrials,
          (trial) =>
            Match.value(trial.state).pipe(
              Match.tag("Completed", ({ value }) => Option.some(Objective.toVector(value))),
              Match.orElse(() => Option.none())
            )
        )
        const recomputedFrontierIndices = Optimizer.effectSearchInterop.pareto.nonDominatedIndices(
          vectors,
          bridgeAmplificationDirections
        )

        yield* logExampleStage("bridge-amplification-summary", {
          completionReason,
          trialCount: Arr.length(allTrials),
          paretoFrontierSize: Arr.length(completedTrials),
          recomputedFrontierSize: Arr.length(recomputedFrontierIndices),
          summaryKind: bridgeFlowSummary.kind,
          summaryParetoCount: bridgeFlowSummary.paretoCount
        })

        yield* Effect.forEach(Arr.take(completedTrials, 4), (trial) =>
          Effect.gen(function*() {
            const vector = Objective.toVector(trial.state.value)

            yield* Effect.log("example:14 bridge-amplification pareto solution", {
              trialNumber: trial.trialNumber,
              bridgePropagation: Arr.get(vector, 0),
              convergenceLift: Arr.get(vector, 1),
              suppressionRisk: Arr.get(vector, 2),
              config: trial.config
            })
          }), { discard: true })
      })),
    Match.tag(
      "SingleObjective",
      ({ completionReason, trials }) =>
        logExampleStage("bridge-amplification-unexpected-single-objective", {
          completionReason,
          trialCount: Arr.length(Arr.fromIterable(trials))
        })
    ),
    Match.exhaustive
  )

  const convergenceFlowTopologies = Match.value(convergenceFlowResult).pipe(
    Match.tag(
      "MultiObjective",
      ({ paretoFront }) => Arr.map(Arr.fromIterable(paretoFront), (trial) => trial.config.topology)
    ),
    Match.tag("SingleObjective", ({ bestTrial }) => Arr.make(bestTrial.config.topology)),
    Match.exhaustive
  )

  const bridgeFlowTopologies = Match.value(bridgeFlowResult).pipe(
    Match.tag(
      "MultiObjective",
      ({ paretoFront }) => Arr.map(Arr.fromIterable(paretoFront), (trial) => trial.config.topology)
    ),
    Match.tag("SingleObjective", ({ bestTrial }) => Arr.make(bestTrial.config.topology)),
    Match.exhaustive
  )

  const sharedTopologySignal = Arr.reduce(
    convergenceFlowTopologies,
    0,
    (count, topology) =>
      Bool.match(Arr.contains(bridgeFlowTopologies, topology), {
        onTrue: () => Num.increment(count),
        onFalse: () => count
      })
  )

  yield* logExampleStage("final-summary", {
    gepaBaselineProtocolFit: gepaOutcome.baselineExactMatch,
    gepaOptimizedProtocolFit: gepaOutcome.optimizedExactMatch,
    gepaScoreDelta: gepaOutcome.scoreDelta,
    convergenceFlowParetoCount: convergenceFlowSummary.paretoCount,
    bridgeFlowParetoCount: bridgeFlowSummary.paretoCount,
    sharedTopologySignal,
    scenarioCount: Arr.length(conversationalRecallScenarios),
    pnasDesignAnchor: "10 participants, 3 dyadic turn-taking conversations, 150 seconds per conversation"
  })
})

BunRuntime.runMain(withLiveLanguageModel(program).pipe(Effect.scoped))
