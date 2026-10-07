/**
 * Optimizes a live collective-memory protocol panel with BootstrapFewShot and
 * MIPROv2. The analyst diagnoses reinforcement, suppression, and network-distance
 * signals before the planner selects topology, sequencing, and convergence
 * expectations under a fixed interaction budget.
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
 * Run: bun run examples/12-miprov2-collective-memory-network-dynamics.ts
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { BootstrapFewShot, Evaluate, Example, Metric, MIPROv2, Module, Signature } from "@scenesystems/effect-dsp"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  Array as Arr,
  Boolean,
  Effect,
  Iterable as Iter,
  Layer,
  Match,
  Number,
  Option,
  Predicate,
  Record,
  Ref,
  Schema,
  String
} from "effect"
import {
  makeStandardEvents,
  makeStandardModuleState,
  makeStandardSummary,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { liveTeacherLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"
import { formatScore } from "./shared/score-format.js"

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
    labels: Option.some({
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      convergenceForecast: "high",
      protocolAdjustment:
        "Schedule bridge ties in early rounds so reinforced details propagate before local repetition hardens clusters.",
      rationale:
        "Shorter average path lengths spread reinforced items network-wide and increase post-conversation convergence."
    })
  }),
  new Example.Example({
    input: {
      objective: "Estimate a clean degree-of-separation slope for mnemonic alignment.",
      baselineNetwork: "Investigators need distances that span 1 to 5 links.",
      dyadicSignal: "Reinforcement and suppression effects are present but should remain comparable across rounds.",
      degreeProfile: "Research team wants visible decay in alignment over longer paths.",
      designConstraint: "Keep the same conversation count per participant across all conditions."
    },
    labels: Option.some({
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      convergenceForecast: "moderate",
      protocolAdjustment:
        "Preserve modular clusters during early rounds to retain longer path distances for inferential contrast.",
      rationale:
        "Clustered topology provides wider separation ranges, making distance-dependent alignment effects easier to measure."
    })
  }),
  new Example.Example({
    input: {
      objective: "Rapidly align collective memory around accurate outbreak guidance.",
      baselineNetwork: "Current structure isolates several subgroups with weak bridge ties.",
      dyadicSignal: "Conversation strongly reinforces mentioned preventive actions.",
      degreeProfile: "Alignment remains local when bridge conversations happen late.",
      designConstraint: "Do not increase participant count or total conversation budget."
    },
    labels: Option.some({
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      convergenceForecast: "high",
      protocolAdjustment:
        "Front-load cross-cluster conversations so high-value items become central in the network memory graph.",
      rationale: "Early bridge exposure increases item centrality and accelerates community-wide mnemonic convergence."
    })
  }),
  new Example.Example({
    input: {
      objective: "Compare subgroup narratives while still producing within-group alignment.",
      baselineNetwork: "Two communities should remain partially distinct for causal comparison.",
      dyadicSignal: "Suppression spillover is a risk when conversations repeatedly omit minority details.",
      degreeProfile: "Team wants local convergence but not full network homogenization.",
      designConstraint: "Interaction budget and conversation duration are fixed by protocol ethics review."
    },
    labels: Option.some({
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      convergenceForecast: "moderate",
      protocolAdjustment:
        "Prioritize within-cluster exchanges before any bridge rounds to protect subgroup-specific memory traces.",
      rationale: "Cluster-first ordering supports local alignment while limiting immediate network-wide convergence."
    })
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
    labels: Option.some({
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      convergenceForecast: "high",
      protocolAdjustment: "Reduce effective diameter first, then repeat key items inside local neighborhoods.",
      rationale:
        "Bridge-first scheduling amplifies global spread of reinforced memories under fixed interaction budgets."
    })
  }),
  new Example.Example({
    input: {
      objective: "Test how mnemonic alignment decays by conversational distance.",
      baselineNetwork: "Analysts need broad variation in path lengths for model fitting.",
      dyadicSignal: "Both reinforcement and suppression should be observable without immediate full diffusion.",
      degreeProfile: "Distance bins from one to five links are required.",
      designConstraint: "Conversation count and timing per participant must stay constant."
    },
    labels: Option.some({
      networkCondition: "clustered",
      sequencingPolicy: "cluster-first",
      convergenceForecast: "moderate",
      protocolAdjustment: "Keep clusters intact through early rounds to preserve measurable distance gradients.",
      rationale: "Clustered structure sustains longer paths, improving identification of degree-of-separation effects."
    })
  }),
  new Example.Example({
    input: {
      objective: "Speed collective memory formation for disaster-response checklists.",
      baselineNetwork: "Teams begin in isolated triads with weak cross-team communication.",
      dyadicSignal: "Reinforcement dominates when checklist items are repeatedly referenced.",
      degreeProfile: "Late bridging delays network-wide alignment.",
      designConstraint: "No additional sessions allowed; only ordering and topology can change."
    },
    labels: Option.some({
      networkCondition: "nonclustered",
      sequencingPolicy: "bridge-early",
      convergenceForecast: "high",
      protocolAdjustment: "Assign early bridge conversations among triads before repeating content within each triad.",
      rationale: "Early bridging converts local reinforcement into community-level convergence more efficiently."
    })
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

const ProtocolOutput = Schema.Struct({
  networkCondition: Signature.describe(Schema.String, "Chosen topology: clustered or nonclustered"),
  sequencingPolicy: Signature.describe(Schema.String, "Chosen ordering policy: cluster-first or bridge-early"),
  convergenceForecast: Signature.describe(Schema.String, "Expected convergence lift: high, moderate, or low"),
  protocolAdjustment: Signature.describe(Schema.String, "Specific design adjustment"),
  rationale: Signature.describe(Schema.String, "Rationale grounded in network and memory dynamics")
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
      Boolean.and(Number.isGreaterThan(String.length(token), 3), Boolean.not(Arr.contains(STOP_WORDS, token))))
  )

const tokenOverlapScore = (predicted: string, expected: string): number => {
  const expectedTokens = narrativeTokens(expected)

  const predictedTokens = narrativeTokens(predicted)
  const overlapCount = Arr.length(Arr.intersection(expectedTokens, predictedTokens))

  return Option.getOrElse(Number.divide(overlapCount, Arr.length(expectedTokens)), () => 0)
}

const conditionKeywords = (condition: string) =>
  Match.value(condition).pipe(
    Match.when("nonclustered", () =>
      Arr.make("bridge", "cross", "path", "diameter", "network", "global", "diffus", "spread")),
    Match.when("clustered", () =>
      Arr.make("cluster", "modular", "within", "local", "distance", "separation", "subgroup")),
    Match.orElse(() =>
      Arr.empty<string>()
    )
  )

const sequenceKeywords = (policy: string) =>
  Match.value(policy).pipe(
    Match.when("bridge-early", () => Arr.make("bridge", "cross", "early", "first", "front", "before")),
    Match.when("cluster-first", () => Arr.make("cluster", "within", "local", "first", "before")),
    Match.orElse(() => Arr.empty<string>())
  )

const forecastKeywords = (forecast: string) =>
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
  Boolean.match(Iter.some(keywords, (keyword) => String.includes(keyword)(narrative)), {
    onTrue: () => 1,
    onFalse: () => 0
  })

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
const protocolMetric = Metric.withFeedback((example, result) =>
  Effect.gen(function*() {
    const prediction = yield* Schema.decodeUnknownEffect(Schema.toType(ProtocolOutput))(result.output)
    const expected = yield* Schema.decodeUnknownEffect(ProtocolOutput)(Option.getOrElse(example.labels, () => ({})))
    const predictedConditionRaw = prediction.networkCondition
    const predictedSequenceRaw = prediction.sequencingPolicy
    const predictedForecastRaw = prediction.convergenceForecast
    const predictedAdjustmentRaw = prediction.protocolAdjustment
    const predictedRationaleRaw = prediction.rationale

    const expectedConditionRaw = expected.networkCondition
    const expectedSequenceRaw = expected.sequencingPolicy
    const expectedForecastRaw = expected.convergenceForecast
    const expectedAdjustmentRaw = expected.protocolAdjustment
    const expectedRationaleRaw = expected.rationale

    const predictedCondition = normalizeNetworkCondition(predictedConditionRaw)
    const predictedSequence = normalizeSequencingPolicy(predictedSequenceRaw)
    const predictedForecast = normalizeConvergenceForecast(predictedForecastRaw)
    const predictedNarrative = normalizeNarrative(
      Arr.join(Arr.make(predictedAdjustmentRaw, predictedRationaleRaw), " ")
    )

    const expectedCondition = normalizeNetworkCondition(expectedConditionRaw)
    const expectedSequence = normalizeSequencingPolicy(expectedSequenceRaw)
    const expectedForecast = normalizeConvergenceForecast(expectedForecastRaw)

    const conditionScore = Boolean.match(String.Equivalence(predictedCondition, expectedCondition), {
      onTrue: () => 1,
      onFalse: () => 0
    })
    const sequenceScore = Boolean.match(String.Equivalence(predictedSequence, expectedSequence), {
      onTrue: () => 1,
      onFalse: () => 0
    })
    const forecastScore = Boolean.match(String.Equivalence(predictedForecast, expectedForecast), {
      onTrue: () => 1,
      onFalse: () => 0
    })
    const decisionTupleScore = Number.sumAll(
      Arr.make(
        Number.multiply(conditionScore, 0.4),
        Number.multiply(sequenceScore, 0.4),
        Number.multiply(forecastScore, 0.2)
      )
    )
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
      Number.sumAll(
        Arr.make(
          Number.multiply(decisionTupleScore, 0.65),
          Number.multiply(mechanismSupportScore, 0.2),
          Number.multiply(explanationAlignmentScore, 0.15)
        )
      )
    )
    const mismatchLines = Arr.filter(
      Arr.make(
        Boolean.match(String.Equivalence(predictedCondition, expectedCondition), {
          onTrue: () => "",
          onFalse: () =>
            Arr.join(
              Arr.make("networkCondition expected='", expectedCondition, "' got='", predictedCondition, "'"),
              ""
            )
        }),
        Boolean.match(String.Equivalence(predictedSequence, expectedSequence), {
          onTrue: () => "",
          onFalse: () =>
            Arr.join(Arr.make("sequencingPolicy expected='", expectedSequence, "' got='", predictedSequence, "'"), "")
        }),
        Boolean.match(String.Equivalence(predictedForecast, expectedForecast), {
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
        "decisionTuple=",
        formatScore(decisionTupleScore, 2),
        " mechanismSupport=",
        formatScore(mechanismSupportScore, 2),
        " explanationAlignment=",
        formatScore(explanationAlignmentScore, 2),
        " ",
        mismatchSummary
      ),
      ""
    )

    return new Metric.Score({ value: score, feedback: Option.some(feedback) })
  }), "collectiveMemoryProtocolFit")

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(EXAMPLE_NAME)

  // Define role signatures for the two-step analytic pipeline.
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
    ProtocolOutput.fields
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
    ProtocolOutput.fields
  )

  // Construct the modules.
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
  const teacherLayer = yield* liveTeacherLayer()

  // Compose the analyst and planner into one optimizable panel.
  const protocolPanel = yield* Module.compose(
    new Module.ComposeOptions({
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
  )
  const parametersBeforeBootstrap = yield* Ref.get(protocolPlanner.parameters)

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

  // Evaluate the baseline.
  yield* logExampleStage("baseline-evaluation-started", {
    evalExampleCount: Arr.length(evalset)
  })

  const baseline = yield* Evaluate.run(
    new Evaluate.Options({
      module: protocolPanel,
      examples: evalset,
      metrics: { protocolFit: protocolMetric },
      concurrency: 1
    })
  )

  // Seed demonstrations through teacher bootstrapping.
  yield* logExampleStage("bootstrap-warm-start-started", {
    trainExampleCount: Arr.length(trainset),
    maxRounds: 2,
    maxBootstrappedDemos: 3,
    metricThreshold: Number.divideUnsafe(2, 3)
  })

  const bootstrapLog = yield* Ref.make(Arr.empty<BootstrapFewShot.Event>())
  const binder = yield* ModelBinder.Current
  const bootstrapped = yield* BootstrapFewShot.runWithEvents(
    new BootstrapFewShot.Options({
      module: protocolPanel,
      trainset,
      metric: protocolMetric,
      maxRounds: 2,
      maxBootstrappedDemos: 3,
      metricThreshold: Option.some(Number.divideUnsafe(2, 3)),
      maxLabeledDemos: 3
    }),
    (event) =>
      Ref.update(bootstrapLog, Arr.append(event)).pipe(
        Effect.andThen(logExampleEvent("bootstrapFewShot", BootstrapFewShot.formatEvent(event).text))
      )
  ).pipe(ModelBinder.withBinder(
    new ModelBinder.Binder({
      bind: (request) =>
        Boolean.match(request.role === "teacher", {
          onTrue: () => (effect) => effect.pipe(Effect.provide(teacherLayer)),
          onFalse: () => binder.bind(request)
        })
    })
  ))
  yield* Module.install(protocolPanel, bootstrapped.parameters)
  const bootstrapEvents = yield* Ref.get(bootstrapLog)
  const bootstrapSummary = BootstrapFewShot.summarizeEvents(bootstrapEvents)
  const parametersAfterBootstrap = yield* Ref.get(protocolPlanner.parameters)
  const demosAddedDuringBootstrap = Number.subtract(
    Arr.length(parametersAfterBootstrap.demos),
    Arr.length(parametersBeforeBootstrap.demos)
  )

  yield* logExampleStage("bootstrap-warm-start-completed", {
    totalEvents: bootstrapSummary.totalEvents,
    roundsStarted: bootstrapSummary.roundsStarted,
    roundsCompleted: bootstrapSummary.roundsCompleted,
    traceAcceptedCount: bootstrapSummary.traceAcceptedCount,
    traceRejectedCount: bootstrapSummary.traceRejectedCount,
    labeledCount: bootstrapSummary.labeledCount,
    demoCountBeforeBootstrap: Arr.length(parametersBeforeBootstrap.demos),
    demoCountAfterBootstrap: Arr.length(parametersAfterBootstrap.demos),
    demosAddedDuringBootstrap,
    totalDemos: bootstrapSummary.totalDemos,
    roundsUsed: bootstrapSummary.roundsUsed
  })

  // Co-optimize instructions and demonstration use with MIPROv2.
  yield* logExampleStage("miprov2-stream-started", {
    numCandidates: 4,
    numTrials: 6,
    minibatch: false,
    seed: 33
  })

  const miproLog = yield* Ref.make(Arr.empty<MIPROv2.Event>())
  const compiled = yield* MIPROv2.runWithEvents(
    new MIPROv2.Options({
      module: protocolPanel,
      trainset,
      valset: evalset,
      metric: protocolMetric,
      numCandidates: 4,
      auto: Option.none(),
      minibatch: false,
      numTrials: 6,
      seed: 33
    }),
    (event) =>
      Ref.update(miproLog, Arr.append(event)).pipe(
        Effect.andThen(logExampleEvent("miprov2", MIPROv2.formatEvent(event).text))
      )
  )
  yield* Module.install(protocolPanel, compiled.parameters)
  const miproEvents = yield* Ref.get(miproLog)
  const miproEventSummary = MIPROv2.summarizeEvents(miproEvents)

  const optimized = yield* Evaluate.run(
    new Evaluate.Options({
      module: protocolPanel,
      examples: evalset,
      metrics: { protocolFit: protocolMetric },
      concurrency: 1
    })
  )

  const optimizedParameters = yield* Ref.get(protocolPlanner.parameters)

  const baselineScore = Option.getOrElse(Record.get(baseline.overallScores, "protocolFit"), () => 0)
  const optimizedScore = Option.getOrElse(Record.get(optimized.overallScores, "protocolFit"), () => 0)
  const miproOutcome = {
    baselineExactMatch: baselineScore,
    optimizedExactMatch: optimizedScore,
    scoreDelta: Number.subtract(optimizedScore, baselineScore),
    demoCountBeforeOptimization: Arr.length(parametersAfterBootstrap.demos),
    demoCountAfterOptimization: Arr.length(optimizedParameters.demos),
    demosLearnedDuringMIPROv2: Number.subtract(
      Arr.length(optimizedParameters.demos),
      Arr.length(parametersAfterBootstrap.demos)
    )
  }
  const optimizationObservability = MIPROv2.summarizeOptimization({
    baselineScore,
    optimizedScore,
    eventSummary: miproEventSummary
  })
  const panelSavedState = yield* Module.save(protocolPanel)
  const summaryArtifact = makeStandardSummary({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    metricName: "collectiveMemoryProtocolFit",
    baselineScore,
    optimizedScore,
    eventCount: Number.sum(Arr.length(bootstrapEvents), Arr.length(miproEvents)),
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
        metricThreshold: Number.divideUnsafe(2, 3),
        maxLabeledDemos: 3
      },
      miprov2: {
        numCandidates: 4,
        numTrials: 6,
        minibatch: false,
        seed: 33
      }
    },
    trainsetSize: Arr.length(trainset),
    valsetSize: Arr.length(evalset),
    evalsetSize: Arr.length(evalset),
    instructionBefore: parametersAfterBootstrap.instructions,
    instructionAfter: optimizedParameters.instructions,
    demoCountBefore: Arr.length(parametersAfterBootstrap.demos),
    demoCountAfter: Arr.length(optimizedParameters.demos),
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
  const eventsArtifact = makeStandardEvents({
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
  const moduleStateArtifact = makeStandardModuleState({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    state: panelSavedState
  })
  const artifactPaths = yield* writeStandardArtifacts({
    artifacts,
    summary: summaryArtifact,
    events: eventsArtifact,
    moduleState: moduleStateArtifact
  }).pipe(Effect.provide(artifacts.artifactContextLayer))

  yield* logExampleStage("summary", {
    baselineProtocolFit: miproOutcome.baselineExactMatch,
    optimizedProtocolFit: miproOutcome.optimizedExactMatch,
    retainedGain: optimizationObservability.retainedGain,
    searchBestProtocolFit: optimizationObservability.searchBestScore,
    searchGain: optimizationObservability.searchGain,
    retainedVsSearchGap: optimizationObservability.retainedVsSearchGap,
    searchImprovedButRetainedFlat: optimizationObservability.searchImprovedButRetainedFlat,
    demoCountBeforeBootstrap: Arr.length(parametersBeforeBootstrap.demos),
    demoCountAfterBootstrap: Arr.length(parametersAfterBootstrap.demos),
    demosAddedDuringBootstrap,
    demoCountBeforeMIPROv2: miproOutcome.demoCountBeforeOptimization,
    demoCountAfterMIPROv2: miproOutcome.demoCountAfterOptimization,
    demosLearnedDuringMIPROv2: miproOutcome.demosLearnedDuringMIPROv2,
    bootstrapLabeledCount: bootstrapSummary.labeledCount,
    learnedInstructionPreview: String.slice(0, 180)(optimizedParameters.instructions),
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
  withLiveLanguageModel(program).pipe(
    Effect.scoped,
    Effect.provide(Layer.merge(noopArtifactSinkLayer, BunServices.layer))
  )
)
