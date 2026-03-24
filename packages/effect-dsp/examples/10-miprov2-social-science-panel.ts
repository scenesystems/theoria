/**
 * MIPROv2 live optimization for a social-science intervention panel.
 *
 * A senior theorist module first infers latent constructs from field notes,
 * then a student planner module proposes one intervention lever:
 * `norms`, `incentives`, or `information`.
 *
 * This demonstrates:
 * - LLM-to-LLM handoff (teacher theorist → student planner)
 * - Explicit teacher/student layering via `liveLanguageModelLayer`
 * - `Optimizer.bootstrapFewShot` teacher warm-start
 * - `Optimizer.miprov2Stream` instruction+demo optimization with event traces
 * - `Evaluate.run` baseline vs optimized exact-match scoring
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Optional env:
 *   DSP_PROVIDER=openai|anthropic|openrouter
 *   DSP_PROVIDER_MODEL=gpt-4o-mini
 *
 * Run: bun run examples/10-miprov2-social-science-panel.ts
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Layer, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import {
  makeStandardEvents,
  makeStandardModuleState,
  makeStandardSummary,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { liveLanguageModelLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"

const EXAMPLE_NAME = "10-miprov2-social-science-panel"

const trainset = Arr.make(
  new Example.Example({
    input: {
      fieldNote:
        "Residents skip local elections because they believe turnout is always low and nobody in their block votes.",
      inferredConstruct: "pluralistic ignorance around civic participation norms"
    },
    output: {
      intervention: "norms",
      justification: "Public norm signals can correct false beliefs about what peers actually do."
    }
  }),
  new Example.Example({
    input: {
      fieldNote:
        "Gig workers ignore retirement enrollment because fee disclosures are hard to compare and terms are confusing.",
      inferredConstruct: "information frictions and low institutional clarity"
    },
    output: {
      intervention: "information",
      justification: "Simplified, trusted explanations reduce comprehension barriers."
    }
  }),
  new Example.Example({
    input: {
      fieldNote: "Households sharply reduced home-energy conservation once the rebate expired.",
      inferredConstruct: "high sensitivity to immediate financial rewards"
    },
    output: {
      intervention: "incentives",
      justification: "Behavior tracks immediate costs and rewards, so incentives dominate."
    }
  }),
  new Example.Example({
    input: {
      fieldNote:
        "Students attend peer tutoring consistently only after team captains publicly commit to weekly attendance.",
      inferredConstruct: "peer accountability and visible commitment cues"
    },
    output: {
      intervention: "norms",
      justification: "Visible commitments create social expectation pressure."
    }
  })
)

const evalset = Arr.make(
  new Example.Example({
    input: {
      fieldNote: "Clinic attendance rose when neighborhoods published weekly participation rates by block.",
      inferredConstruct: "behavior responds to descriptive norm visibility"
    },
    output: {
      intervention: "norms",
      justification: "Public participation signals shift expectations about common behavior."
    }
  }),
  new Example.Example({
    input: {
      fieldNote: "Workers only completed optional training when a completion bonus was added to the monthly paycheck.",
      inferredConstruct: "short-term compensation salience"
    },
    output: {
      intervention: "incentives",
      justification: "Immediate rewards increase uptake when time costs are salient."
    }
  }),
  new Example.Example({
    input: {
      fieldNote:
        "Parents delayed vaccine appointments because reminder letters used technical language and unclear scheduling instructions.",
      inferredConstruct: "instructional complexity and comprehension barriers"
    },
    output: {
      intervention: "information",
      justification: "Clear, concrete instructions reduce decision friction."
    }
  })
)

const logExampleStage = (
  stage: string,
  payload: Readonly<Record<string, unknown>>
) =>
  Effect.log("example:10 stage", {
    stage,
    ...payload
  })

const logExampleEvent = (
  optimizer: string,
  line: string
) =>
  Effect.log("example:10 optimizer event", {
    optimizer,
    line
  })

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(EXAMPLE_NAME)

  const constructSignature = yield* Signature.make(
    "Infer latent behavioral constructs from qualitative field notes",
    {
      fieldNote: Signature.describe(Schema.String, "Raw qualitative field note from a social-science study")
    },
    {
      construct: Signature.describe(Schema.String, "Latent construct inferred from the note"),
      rationale: Signature.describe(Schema.String, "One-sentence reasoning for the construct")
    }
  )

  const policySignature = yield* Signature.make(
    "Choose one intervention lever for behavior change. Return intervention as one of: norms, incentives, information.",
    {
      fieldNote: Signature.describe(Schema.String, "Qualitative field note describing observed behavior"),
      inferredConstruct: Signature.describe(Schema.String, "Behavioral construct inferred by the theorist")
    },
    {
      intervention: Signature.describe(
        Schema.String,
        "Single intervention lever label: norms, incentives, or information"
      ),
      justification: Signature.describe(Schema.String, "Short explanation grounded in the construct")
    }
  )

  const theorist = yield* Module.chainOfThought("qualitative-theorist", constructSignature)
  const planner = yield* Module.predict("intervention-planner", policySignature)
  const teacherLayer = liveLanguageModelLayer().pipe(Layer.orDie)

  const collaborativeFieldNote =
    "In a city budgeting forum, residents said they would participate only if they knew neighbors were already attending."

  const teacherTurn = yield* theorist
    .forward({
      fieldNote: collaborativeFieldNote
    })
    .pipe(Effect.provide(teacherLayer))

  const studentTurn = yield* planner.forward({
    fieldNote: collaborativeFieldNote,
    inferredConstruct: teacherTurn.construct
  })

  yield* logExampleStage("collaborative-turn", {
    teacherConstruct: teacherTurn.construct,
    teacherRationale: teacherTurn.rationale,
    studentIntervention: studentTurn.intervention,
    studentJustification: studentTurn.justification
  })

  const metrics = { exactMatch: Metric.exactMatch("intervention") }
  const baselineParams = yield* Ref.get(planner.params)

  yield* logExampleStage("baseline-evaluation-started", {
    evalExampleCount: evalset.length
  })

  const baseline = yield* Evaluate.run({
    module: planner,
    examples: evalset,
    metrics,
    concurrency: 1
  })

  yield* logExampleStage("bootstrap-warm-start-started", {
    trainExampleCount: trainset.length,
    maxRounds: 1,
    maxBootstrappedDemos: 3
  })

  const bootstrapEventsChunk = yield* Optimizer.bootstrapFewShotStream({
    module: planner,
    trainset,
    metric: Metric.exactMatch("intervention"),
    maxRounds: 1,
    maxBootstrappedDemos: 3,
    threshold: 1,
    teacher: teacherLayer
  }).pipe(
    Optimizer.tapBootstrapProgress((line) => logExampleEvent("bootstrapFewShot", line.text)),
    Stream.runCollect
  )
  const bootstrapEvents = Arr.fromIterable(bootstrapEventsChunk)
  const bootstrapSummary = Optimizer.summarizeBootstrapEvents(bootstrapEvents)

  yield* logExampleStage("bootstrap-warm-start-completed", {
    totalEvents: bootstrapSummary.totalEvents,
    roundsStarted: bootstrapSummary.roundsStarted,
    roundsCompleted: bootstrapSummary.roundsCompleted,
    traceAcceptedCount: bootstrapSummary.traceAcceptedCount,
    traceRejectedCount: bootstrapSummary.traceRejectedCount,
    fallbackActivatedSeen: bootstrapSummary.fallbackActivatedSeen,
    fallbackCompletedSeen: bootstrapSummary.fallbackCompletedSeen,
    fallbackUsed: bootstrapSummary.fallbackUsed,
    totalDemos: bootstrapSummary.totalDemos,
    roundsUsed: bootstrapSummary.roundsUsed
  })

  yield* logExampleStage("miprov2-stream-started", {
    numCandidates: 4,
    numInstructions: 4,
    trialBudget: 6,
    seed: 17
  })

  const miproEventsChunk = yield* Optimizer.miprov2Stream({
    module: planner,
    trainset,
    valset: evalset,
    metric: Metric.exactMatch("intervention"),
    numCandidates: 4,
    numInstructions: 4,
    trialBudget: 6,
    seed: 17
  }).pipe(
    Optimizer.tapMIPROv2Progress((line) => logExampleEvent("miprov2", line.text)),
    Stream.runCollect
  )

  const miproEvents = Arr.fromIterable(miproEventsChunk)
  const miproEventSummary = Optimizer.summarizeMIPROv2Events(miproEvents)
  const optimized = yield* Evaluate.run({
    module: planner,
    examples: evalset,
    metrics,
    concurrency: 1
  })
  const optimizedParams = yield* Ref.get(planner.params)

  const baselineScore = baseline.overallScores.exactMatch ?? 0
  const optimizedScore = optimized.overallScores.exactMatch ?? 0
  const outcomeSummary = Optimizer.summarizeMIPROv2Outcome({
    baselineExactMatch: baselineScore,
    optimizedExactMatch: optimizedScore,
    demoCountBeforeOptimization: baselineParams.demos.length,
    demoCountAfterOptimization: optimizedParams.demos.length,
    eventSummary: miproEventSummary
  })
  const plannerSavedState = yield* Module.save(planner)
  const summaryArtifact = makeStandardSummary({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    metricName: "exactMatch",
    baselineScore,
    optimizedScore,
    eventCount: bootstrapEvents.length + miproEvents.length,
    optimizationSummary: {
      bootstrap: bootstrapSummary,
      miprov2: miproEventSummary,
      miprov2Outcome: outcomeSummary
    },
    seed: 17,
    optimizationConfig: {
      bootstrap: {
        maxRounds: 1,
        maxBootstrappedDemos: 3,
        threshold: 1
      },
      miprov2: {
        numCandidates: 4,
        numInstructions: 4,
        trialBudget: 6,
        seed: 17
      }
    },
    trainsetSize: trainset.length,
    valsetSize: evalset.length,
    evalsetSize: evalset.length,
    instructionBefore: baselineParams.instructions,
    instructionAfter: optimizedParams.instructions,
    demoCountBefore: baselineParams.demos.length,
    demoCountAfter: optimizedParams.demos.length,
    demosLearnedDuringOptimization: outcomeSummary.demosLearnedDuringMIPROv2,
    extras: {
      baseline,
      optimized,
      teacherTurn,
      studentTurn,
      bootstrapSummary,
      miproEventSummary,
      outcomeSummary
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
    state: plannerSavedState
  })
  const artifactPaths = yield* writeStandardArtifacts({
    artifacts,
    summary: summaryArtifact,
    events: eventsArtifact,
    moduleState: moduleStateArtifact
  }).pipe(Effect.provide(artifacts.envelopeContextLayer))

  yield* logExampleStage("summary", {
    baselineExactMatch: outcomeSummary.baselineExactMatch,
    optimizedExactMatch: outcomeSummary.optimizedExactMatch,
    scoreDelta: outcomeSummary.scoreDelta,
    demoCountBeforeOptimization: outcomeSummary.demoCountBeforeOptimization,
    demoCountAfterOptimization: outcomeSummary.demoCountAfterOptimization,
    demosLearnedDuringMIPROv2: outcomeSummary.demosLearnedDuringMIPROv2,
    bootstrapFallbackUsed: bootstrapSummary.fallbackUsed,
    trialEvaluatedCount: outcomeSummary.eventSummary.trialEvaluatedCount,
    fullEvalCompletedCount: outcomeSummary.eventSummary.fullEvalCompletedCount,
    phase3ConfiguredTrials: outcomeSummary.eventSummary.phase3ConfiguredTrials,
    phase3CompletedTrials: outcomeSummary.eventSummary.phase3CompletedTrials,
    phase3CompletedSeen: outcomeSummary.eventSummary.phase3CompletedSeen,
    phase3BestScoreSeen: outcomeSummary.eventSummary.phase3BestScoreSeen,
    phase3BestScore: outcomeSummary.eventSummary.phase3BestScore,
    artifactPaths
  })
})

BunRuntime.runMain(
  withLiveLanguageModel(program).pipe(Effect.provide(noopArtifactSinkLayer), Effect.provide(BunContext.layer))
)
