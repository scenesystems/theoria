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
import { Evaluate, Example, GEPA, Metric, Module, Signature } from "@scenesystems/effect-dsp"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Contracts, Pareto, Sampler, SearchSpace, Study, Trial } from "@scenesystems/effect-search"
import {
  Array as Arr,
  Boolean,
  Effect,
  Match,
  Number,
  Option,
  Predicate,
  Record,
  Ref,
  Schema,
  Stream,
  String
} from "effect"
import { liveTeacherLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"
import { formatScore } from "./shared/score-format.js"

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
  payload: typeof Schema.Object.Type
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

const formatObjectives = (names: ReadonlyArray<string>, values: ReadonlyArray<number>) =>
  Record.fromEntries(Arr.zip(
    names,
    Arr.map(Arr.fromIterable(values), (value) => formatScore(value, 3))
  ))

const ProtocolOutput = Schema.Struct({
  networkCondition: Signature.describe(Schema.String, "Topology decision: clustered or nonclustered"),
  sequencingPolicy: Signature.describe(Schema.String, "Scheduling decision: cluster-first or bridge-early"),
  turnTakingPolicy: Signature.describe(
    Schema.String,
    "Turn-taking policy: strict-alternation, balanced-free-recall, or bridge-speaker-priority"
  ),
  convergenceForecast: Signature.describe(Schema.String, "Expected convergence regime: high/moderate/low"),
  protocolAdjustment: Signature.describe(Schema.String, "Concrete protocol adjustment"),
  analysisPlan: Signature.describe(Schema.String, "Analysis plan linked to convergence and alignment")
})

const normalizeLabel = (value: string): string => String.trim(String.replaceAll("_", "-")(String.toLowerCase(value)))

const normalizeNetworkCondition = (value: string): string =>
  Match.value(normalizeLabel(value)).pipe(
    Match.when(
      Predicate.and(Predicate.or(String.includes("non"), String.includes("single")), String.includes("cluster")),
      () => "nonclustered"
    ),
    Match.when(String.includes("cluster"), () => "clustered"),
    Match.orElse(() => "")
  )

const normalizeSequencingPolicy = (value: string): string =>
  Match.value(normalizeLabel(value)).pipe(
    Match.when(
      Predicate.or(String.includes("bridge"), Predicate.and(String.includes("cross"), String.includes("cluster"))),
      () => "bridge-early"
    ),
    Match.when(Predicate.or(String.includes("cluster"), String.includes("within")), () => "cluster-first"),
    Match.orElse(() => "")
  )

const normalizeTurnTakingPolicy = (value: string): string =>
  Match.value(normalizeLabel(value)).pipe(
    Match.when(Predicate.or(String.includes("strict"), String.includes("alternat")), () => "strict-alternation"),
    Match.when(Predicate.or(String.includes("bridge"), String.includes("priority")), () => "bridge-speaker-priority"),
    Match.when(Predicate.or(String.includes("balanced"), String.includes("free")), () => "balanced-free-recall"),
    Match.orElse(() => "")
  )

const normalizeConvergenceForecast = (value: string): string =>
  Match.value(normalizeLabel(value)).pipe(
    Match.when(Predicate.or(String.includes("high"), String.includes("strong")), () => "high"),
    Match.when(
      Predicate.some(Arr.make(String.includes("moderate"), String.includes("medium"), String.includes("mixed"))),
      () => "moderate"
    ),
    Match.when(Predicate.or(String.includes("low"), String.includes("weak")), () => "low"),
    Match.orElse(() => "")
  )

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

const averageScore = (scores: ReadonlyArray<number>): number => {
  const values = Arr.fromIterable(scores)
  return Option.getOrElse(Number.divide(Number.sumAll(values), Arr.length(values)), () => 0)
}

const normalizeNarrative = (value: string): string =>
  String.trim(String.replaceAll(/[^a-z0-9]+/g, " ")(String.toLowerCase(value)))

const narrativeTokens = (value: string) =>
  Arr.dedupe(
    Arr.filter(String.split(normalizeNarrative(value), " "), (token) =>
      Boolean.and(Number.greaterThan(String.length(token), 3), Boolean.not(Arr.contains(STOP_WORDS, token))))
  )

const tokenOverlapScore = (predicted: string, expected: string): number => {
  const expectedTokens = narrativeTokens(expected)

  const predictedTokens = narrativeTokens(predicted)
  const overlapCount = Arr.length(Arr.intersection(expectedTokens, predictedTokens))

  return Option.getOrElse(Number.divide(overlapCount, Arr.length(expectedTokens)), () => 0)
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
  (prediction: typeof ProtocolOutput.Type, expected) =>
    Effect.sync(() => {
      const predictedConditionRaw = prediction.networkCondition
      const predictedSequencingRaw = prediction.sequencingPolicy
      const predictedTurnPolicyRaw = prediction.turnTakingPolicy
      const predictedForecastRaw = prediction.convergenceForecast
      const predictedAdjustmentRaw = prediction.protocolAdjustment
      const predictedAnalysisPlanRaw = prediction.analysisPlan

      const expectedConditionRaw = expected.networkCondition
      const expectedSequencingRaw = expected.sequencingPolicy
      const expectedTurnPolicyRaw = expected.turnTakingPolicy
      const expectedForecastRaw = expected.convergenceForecast
      const expectedAdjustmentRaw = expected.protocolAdjustment
      const expectedAnalysisPlanRaw = expected.analysisPlan

      const predictedCondition = normalizeNetworkCondition(predictedConditionRaw)
      const predictedSequencing = normalizeSequencingPolicy(predictedSequencingRaw)
      const predictedTurnPolicy = normalizeTurnTakingPolicy(predictedTurnPolicyRaw)
      const predictedForecast = normalizeConvergenceForecast(predictedForecastRaw)

      const expectedCondition = normalizeNetworkCondition(expectedConditionRaw)
      const expectedSequencing = normalizeSequencingPolicy(expectedSequencingRaw)
      const expectedTurnPolicy = normalizeTurnTakingPolicy(expectedTurnPolicyRaw)
      const expectedForecast = normalizeConvergenceForecast(expectedForecastRaw)

      const conditionScore = Boolean.match(String.Equivalence(predictedCondition, expectedCondition), {
        onTrue: () => 1,
        onFalse: () => 0
      })
      const sequencingScore = Boolean.match(String.Equivalence(predictedSequencing, expectedSequencing), {
        onTrue: () => 1,
        onFalse: () => 0
      })
      const turnPolicyScore = Boolean.match(String.Equivalence(predictedTurnPolicy, expectedTurnPolicy), {
        onTrue: () => 1,
        onFalse: () => 0
      })
      const forecastScore = Boolean.match(String.Equivalence(predictedForecast, expectedForecast), {
        onTrue: () => 1,
        onFalse: () => 0
      })
      const narrativeScore = averageScore(
        Arr.make(
          tokenOverlapScore(predictedAdjustmentRaw, expectedAdjustmentRaw),
          tokenOverlapScore(predictedAnalysisPlanRaw, expectedAnalysisPlanRaw)
        )
      )

      const score = clampUnitScore(
        Number.sumAll(
          Arr.make(
            Number.multiply(conditionScore, 0.25),
            Number.multiply(sequencingScore, 0.25),
            Number.multiply(turnPolicyScore, 0.2),
            Number.multiply(forecastScore, 0.15),
            Number.multiply(narrativeScore, 0.15)
          )
        )
      )

      const mismatchLines = Arr.filter(
        Arr.make(
          Boolean.match(Number.Equivalence(conditionScore, 1), {
            onTrue: () => "",
            onFalse: () =>
              Arr.join(
                Arr.make("networkCondition expected='", expectedCondition, "' got='", predictedCondition, "'"),
                ""
              )
          }),
          Boolean.match(Number.Equivalence(sequencingScore, 1), {
            onTrue: () => "",
            onFalse: () =>
              Arr.join(
                Arr.make("sequencingPolicy expected='", expectedSequencing, "' got='", predictedSequencing, "'"),
                ""
              )
          }),
          Boolean.match(Number.Equivalence(turnPolicyScore, 1), {
            onTrue: () => "",
            onFalse: () =>
              Arr.join(
                Arr.make("turnTakingPolicy expected='", expectedTurnPolicy, "' got='", predictedTurnPolicy, "'"),
                ""
              )
          }),
          Boolean.match(Number.Equivalence(forecastScore, 1), {
            onTrue: () => "",
            onFalse: () =>
              Arr.join(
                Arr.make("convergenceForecast expected='", expectedForecast, "' got='", predictedForecast, "'"),
                ""
              )
          })
        ),
        String.isNonEmpty
      )

      const mismatchSummary = Arr.match(mismatchLines, {
        onEmpty: () => "decisionLabels=aligned",
        onNonEmpty: (lines) => Arr.join(lines, "; ")
      })

      const feedback = Arr.join(
        Arr.make(
          "condition=",
          formatScore(conditionScore, 2),
          " sequencing=",
          formatScore(sequencingScore, 2),
          " turnPolicy=",
          formatScore(turnPolicyScore, 2),
          " forecast=",
          formatScore(forecastScore, 2),
          " narrative=",
          formatScore(narrativeScore, 2),
          " ",
          mismatchSummary
        ),
        ""
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
    ProtocolOutput.fields
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
    ProtocolOutput.fields
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

  const gepaEventsChunk = yield* GEPA.stream({
    module: methodsPanel,
    trainset,
    valset: evalset,
    metric: protocolMetric,
    maxIterations: 4,
    maxMergeInvocations: 4,
    seed: 140
  }).pipe(
    GEPA.tapProgress((line) => logExampleEvent("gepa", line.text)),
    Stream.runCollect
  )

  const optimized = yield* Evaluate.run({
    module: methodsPanel,
    examples: evalset,
    metrics: { protocolFit: protocolMetric },
    concurrency: 1
  })

  const gepaEvents = Arr.fromIterable(gepaEventsChunk)
  const gepaEventSummary = GEPA.summarizeEvents(gepaEvents)
  const panelParamsAfterGEPA = yield* Ref.get(methodsPanel.params)

  const baselineScore = Option.getOrElse(Record.get(baseline.overallScores, "protocolFit"), () => 0)
  const optimizedScore = Option.getOrElse(Record.get(optimized.overallScores, "protocolFit"), () => 0)
  const gepaOutcome = GEPA.summarizeOutcome({
    baselineScore,
    optimizedScore,
    instructionBefore: panelParamsBeforeGEPA.instructions,
    instructionAfter: panelParamsAfterGEPA.instructions,
    events: gepaEventSummary
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
      const scheduleIntensity = Number.unsafeDivide(
        Number.multiply(scenario.conversationsPerParticipant, 60),
        scenario.conversationSeconds
      )
      const topologyBase = Boolean.match(String.Equivalence(config.topology, "nonclustered"), {
        onTrue: () => Number.subtract(0.48, Number.multiply(scenario.diameterPressure, 0.08)),
        onFalse: () => Number.sum(0.37, Number.multiply(scenario.diameterPressure, 0.06))
      })
      const bridgeDiffusion = Number.multiply(
        Number.multiply(config.bridgeTieFraction, Number.unsafeDivide(Number.subtract(4, config.bridgeRound), 3)),
        0.24
      )
      const reinforcementGain = Number.multiply(config.reinforcementWeight, 0.14)
      const recapGain = Number.multiply(Number.unsafeDivide(config.recapWindowSeconds, 60), 0.07)
      const turnPenalty = Number.multiply(
        config.turnInequality,
        Number.sum(0.18, Number.multiply(scenario.turnRigidityDemand, 0.1))
      )
      const suppressionPenalty = Number.multiply(
        Number.multiply(Number.subtract(1, config.suppressionGuard), scenario.suppressionSensitivity),
        0.2
      )

      const conditionAlignment = Boolean.match(String.Equivalence(config.topology, priorCondition), {
        onTrue: () => 0.03,
        onFalse: () => Number.negate(0.02)
      })
      const sequencingLabel = Boolean.match(Number.Equivalence(config.bridgeRound, 1), {
        onTrue: () => "bridge-early",
        onFalse: () => "cluster-first"
      })
      const sequencingAlignment = Boolean.match(String.Equivalence(sequencingLabel, priorSequencing), {
        onTrue: () => 0.02,
        onFalse: () => Number.negate(0.01)
      })
      const turnPolicyAlignment = Match.value(priorTurnPolicy).pipe(
        Match.when("strict-alternation", () => Number.subtract(0.02, Number.multiply(config.turnInequality, 0.05))),
        Match.when(
          "balanced-free-recall",
          () => Number.subtract(0.015, Numeric.abs(Number.subtract(config.turnInequality, 0.2)))
        ),
        Match.when("bridge-speaker-priority", () => Number.sum(0.01, Number.multiply(config.bridgeTieFraction, 0.02))),
        Match.orElse(() => 0)
      )

      const convergenceLift = clampUnitScore(
        Number.subtract(
          Number.subtract(
            Number.sumAll(Arr.make(
              topologyBase,
              bridgeDiffusion,
              reinforcementGain,
              recapGain,
              conditionAlignment,
              sequencingAlignment,
              turnPolicyAlignment,
              Number.multiply(scheduleIntensity, 0.04)
            )),
            turnPenalty
          ),
          suppressionPenalty
        )
      )

      const realizedSlope = Number.sumAll(Arr.make(
        Boolean.match(String.Equivalence(config.topology, "clustered"), { onTrue: () => 0.2, onFalse: () => 0.12 }),
        Number.multiply(Number.unsafeDivide(Number.decrement(config.bridgeRound), 2), 0.07),
        Number.multiply(Number.subtract(1, config.bridgeTieFraction), 0.05),
        Number.multiply(config.turnInequality, 0.05)
      ))
      const slopeError = Numeric.abs(Number.subtract(realizedSlope, scenario.targetSlope))

      const turnInequality = clampUnitScore(
        Number.sum(Number.multiply(config.turnInequality, 0.9), Number.multiply(scenario.turnRigidityDemand, 0.1))
      )

      const suppressionRisk = clampUnitScore(
        Number.sumAll(Arr.make(
          Number.multiply(Number.subtract(1, config.suppressionGuard), 0.58),
          Number.multiply(config.reinforcementWeight, 0.18),
          Boolean.match(String.Equivalence(config.topology, "nonclustered"), {
            onTrue: () => 0.08,
            onFalse: () => 0.04
          }),
          Boolean.match(Number.Equivalence(config.bridgeRound, 1), { onTrue: () => 0.05, onFalse: () => 0.02 }),
          Number.multiply(scenario.suppressionSensitivity, 0.15)
        ))
      )

      const bridgePropagation = clampUnitScore(
        Number.subtract(
          Number.sumAll(Arr.make(
            Number.multiply(
              Number.multiply(config.bridgeTieFraction, Number.unsafeDivide(Number.subtract(4, config.bridgeRound), 3)),
              0.55
            ),
            Boolean.match(String.Equivalence(config.topology, "nonclustered"), {
              onTrue: () => 0.22,
              onFalse: () => 0.12
            }),
            Number.multiply(convergenceLift, 0.2)
          )),
          Number.multiply(suppressionRisk, 0.18)
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
        convergenceLift: Number.sum(acc.convergenceLift, score.convergenceLift),
        slopeError: Number.sum(acc.slopeError, score.slopeError),
        turnInequality: Number.sum(acc.turnInequality, score.turnInequality),
        suppressionRisk: Number.sum(acc.suppressionRisk, score.suppressionRisk),
        bridgePropagation: Number.sum(acc.bridgePropagation, score.bridgePropagation)
      })
    )

    const scenarioCount = Arr.length(conversationalRecallScenarios)

    return {
      convergenceLift: Number.unsafeDivide(sums.convergenceLift, scenarioCount),
      slopeError: Number.unsafeDivide(sums.slopeError, scenarioCount),
      turnInequality: Number.unsafeDivide(sums.turnInequality, scenarioCount),
      suppressionRisk: Number.unsafeDivide(sums.suppressionRisk, scenarioCount),
      bridgePropagation: Number.unsafeDivide(sums.bridgePropagation, scenarioCount)
    }
  }

  // Run the convergence-priority direction flow.
  const convergencePriorityDirections = Arr.make<Arr.NonEmptyArray<Contracts.Direction>>(
    "maximize",
    "minimize",
    "minimize",
    "minimize"
  )

  // Run the bridge-amplification direction flow.
  const bridgeAmplificationDirections = Arr.make<Arr.NonEmptyArray<Contracts.Direction>>(
    "maximize",
    "maximize",
    "minimize"
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
    sampler: Sampler.tpe({
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

  yield* Match.value(convergenceFlowResult).pipe(
    Match.tag("MultiObjective", ({ paretoFront, completionReason, trials }) =>
      Effect.gen(function*() {
        const vectors = Arr.filterMap(
          trials,
          (trial) =>
            Trial.matchState({
              Completed: (state) => Option.some(Contracts.normalizeObjectiveVector(state.value)),
              Running: () => Option.none(),
              Failed: () => Option.none(),
              Pruned: () => Option.none(),
              Cancelled: () => Option.none()
            })(trial.state)
        )
        const recomputedFrontierIndices = Pareto.nonDominatedIndices(
          vectors,
          convergencePriorityDirections
        )

        yield* logExampleStage("convergence-priority-summary", {
          completionReason,
          trialCount: Arr.length(trials),
          paretoFrontierSize: Arr.length(paretoFront),
          recomputedFrontierSize: Arr.length(recomputedFrontierIndices),
          summaryKind: "MultiObjective",
          summaryParetoCount: Arr.length(paretoFront)
        })

        yield* Effect.forEach(Arr.take(paretoFront, 4), (trial) =>
          Effect.gen(function*() {
            const vector = Contracts.normalizeObjectiveVector(trial.state.value)

            yield* Effect.log("example:14 convergence-priority pareto solution", {
              trialNumber: trial.trialNumber,
              ...formatObjectives(
                Arr.make("convergenceLift", "degreeSlopeError", "turnInequality", "suppressionRisk"),
                vector
              ),
              config: trial.config
            })
          }), { discard: true })
      })),
    Match.tag(
      "SingleObjective",
      ({ completionReason, trials }) =>
        logExampleStage("convergence-priority-unexpected-single-objective", {
          completionReason,
          trialCount: Arr.length(trials)
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
    sampler: Sampler.tpe({
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

  yield* Match.value(bridgeFlowResult).pipe(
    Match.tag("MultiObjective", ({ paretoFront, completionReason, trials }) =>
      Effect.gen(function*() {
        const vectors = Arr.filterMap(
          trials,
          (trial) =>
            Trial.matchState({
              Completed: (state) => Option.some(Contracts.normalizeObjectiveVector(state.value)),
              Running: () => Option.none(),
              Failed: () => Option.none(),
              Pruned: () => Option.none(),
              Cancelled: () => Option.none()
            })(trial.state)
        )
        const recomputedFrontierIndices = Pareto.nonDominatedIndices(
          vectors,
          bridgeAmplificationDirections
        )

        yield* logExampleStage("bridge-amplification-summary", {
          completionReason,
          trialCount: Arr.length(trials),
          paretoFrontierSize: Arr.length(paretoFront),
          recomputedFrontierSize: Arr.length(recomputedFrontierIndices),
          summaryKind: "MultiObjective",
          summaryParetoCount: Arr.length(paretoFront)
        })

        yield* Effect.forEach(Arr.take(paretoFront, 4), (trial) =>
          Effect.gen(function*() {
            const vector = Contracts.normalizeObjectiveVector(trial.state.value)

            yield* Effect.log("example:14 bridge-amplification pareto solution", {
              trialNumber: trial.trialNumber,
              ...formatObjectives(Arr.make("bridgePropagation", "convergenceLift", "suppressionRisk"), vector),
              config: trial.config
            })
          }), { discard: true })
      })),
    Match.tag(
      "SingleObjective",
      ({ completionReason, trials }) =>
        logExampleStage("bridge-amplification-unexpected-single-objective", {
          completionReason,
          trialCount: Arr.length(trials)
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
    (count, topology) =>
      Number.sum(
        count,
        Boolean.match(Arr.contains(bridgeFlowTopologies, topology), { onTrue: () => 1, onFalse: () => 0 })
      )
  )

  yield* logExampleStage("final-summary", {
    gepaBaselineProtocolFit: gepaOutcome.baselineExactMatch,
    gepaOptimizedProtocolFit: gepaOutcome.optimizedExactMatch,
    gepaScoreDelta: gepaOutcome.scoreDelta,
    convergenceFlowParetoCount: Match.value(convergenceFlowResult).pipe(
      Match.tag("MultiObjective", ({ paretoFront }) => Arr.length(paretoFront)),
      Match.tag("SingleObjective", () => 1),
      Match.exhaustive
    ),
    bridgeFlowParetoCount: Match.value(bridgeFlowResult).pipe(
      Match.tag("MultiObjective", ({ paretoFront }) => Arr.length(paretoFront)),
      Match.tag("SingleObjective", () => 1),
      Match.exhaustive
    ),
    sharedTopologySignal,
    scenarioCount: Arr.length(conversationalRecallScenarios),
    pnasDesignAnchor: "10 participants, 3 dyadic turn-taking conversations, 150 seconds per conversation"
  })
})

BunRuntime.runMain(withLiveLanguageModel(program).pipe(Effect.scoped))
