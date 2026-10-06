/**
 * Optimizes a live two-module intervention panel with BootstrapFewShot and
 * MIPROv2. The analyst infers a construct from a field note; the planner selects
 * `norms`, `incentives`, or `information` and receives exact-match evaluation.
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
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { BootstrapFewShot, Evaluate, Example, Metric, MIPROv2, Module, Signature } from "@scenesystems/effect-dsp"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Effect, Layer, Option, Ref, Schema } from "effect"
import {
  makeStandardEvents,
  makeStandardModuleState,
  makeStandardSummary,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { liveTeacherLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"

const EXAMPLE_NAME = "10-miprov2-social-science-panel"

const trainset = Arr.make(
  new Example.Example({
    input: {
      fieldNote:
        "Residents skip local elections because they believe turnout is always low and nobody in their block votes.",
      inferredConstruct: "pluralistic ignorance around civic participation norms"
    },
    labels: Option.some({
      intervention: "norms",
      justification: "Public norm signals can correct false beliefs about what peers actually do."
    })
  }),
  new Example.Example({
    input: {
      fieldNote:
        "Gig workers ignore retirement enrollment because fee disclosures are hard to compare and terms are confusing.",
      inferredConstruct: "information frictions and low institutional clarity"
    },
    labels: Option.some({
      intervention: "information",
      justification: "Simplified, trusted explanations reduce comprehension barriers."
    })
  }),
  new Example.Example({
    input: {
      fieldNote: "Households sharply reduced home-energy conservation once the rebate expired.",
      inferredConstruct: "high sensitivity to immediate financial rewards"
    },
    labels: Option.some({
      intervention: "incentives",
      justification: "Behavior tracks immediate costs and rewards, so incentives dominate."
    })
  }),
  new Example.Example({
    input: {
      fieldNote:
        "Students attend peer tutoring consistently only after team captains publicly commit to weekly attendance.",
      inferredConstruct: "peer accountability and visible commitment cues"
    },
    labels: Option.some({
      intervention: "norms",
      justification: "Visible commitments create social expectation pressure."
    })
  })
)

const evalset = Arr.make(
  new Example.Example({
    input: {
      fieldNote: "Clinic attendance rose when neighborhoods published weekly participation rates by block.",
      inferredConstruct: "behavior responds to descriptive norm visibility"
    },
    labels: Option.some({
      intervention: "norms",
      justification: "Public participation signals shift expectations about common behavior."
    })
  }),
  new Example.Example({
    input: {
      fieldNote: "Workers only completed optional training when a completion bonus was added to the monthly paycheck.",
      inferredConstruct: "short-term compensation salience"
    },
    labels: Option.some({
      intervention: "incentives",
      justification: "Immediate rewards increase uptake when time costs are salient."
    })
  }),
  new Example.Example({
    input: {
      fieldNote:
        "Parents delayed vaccine appointments because reminder letters used technical language and unclear scheduling instructions.",
      inferredConstruct: "instructional complexity and comprehension barriers"
    },
    labels: Option.some({
      intervention: "information",
      justification: "Clear, concrete instructions reduce decision friction."
    })
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
  const teacherLayer = yield* liveTeacherLayer()

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
  const baselineParameters = yield* Ref.get(planner.parameters)

  yield* logExampleStage("baseline-evaluation-started", {
    evalExampleCount: evalset.length
  })

  const baseline = yield* Evaluate.run(
    new Evaluate.Options({
      module: planner,
      examples: evalset,
      metrics,
      concurrency: 1
    })
  )

  yield* logExampleStage("bootstrap-warm-start-started", {
    trainExampleCount: trainset.length,
    maxRounds: 1,
    maxBootstrappedDemos: 3
  })

  const bootstrapLog = yield* Ref.make(Arr.empty<BootstrapFewShot.Event>())
  const binder = yield* ModelBinder.Current
  const bootstrapped = yield* BootstrapFewShot.runWithEvents(
    new BootstrapFewShot.Options({
      module: planner,
      trainset,
      metric: Metric.exactMatch("intervention"),
      maxRounds: 1,
      maxBootstrappedDemos: 3,
      metricThreshold: Option.some(1)
    }),
    (event) =>
      Ref.update(bootstrapLog, Arr.append(event)).pipe(
        Effect.andThen(logExampleEvent("bootstrapFewShot", BootstrapFewShot.formatEvent(event).text))
      )
  ).pipe(ModelBinder.withBinder(
    new ModelBinder.Binder({
      bind: (request) =>
        request.role === "teacher" ? (effect) => effect.pipe(Effect.provide(teacherLayer)) : binder.bind(request)
    })
  ))
  yield* Module.install(planner, bootstrapped.parameters)
  const bootstrapEvents = yield* Ref.get(bootstrapLog)
  const bootstrapSummary = BootstrapFewShot.summarizeEvents(bootstrapEvents)

  yield* logExampleStage("bootstrap-warm-start-completed", {
    totalEvents: bootstrapSummary.totalEvents,
    roundsStarted: bootstrapSummary.roundsStarted,
    roundsCompleted: bootstrapSummary.roundsCompleted,
    traceAcceptedCount: bootstrapSummary.traceAcceptedCount,
    traceRejectedCount: bootstrapSummary.traceRejectedCount,
    labeledCount: bootstrapSummary.labeledCount,
    totalDemos: bootstrapSummary.totalDemos,
    roundsUsed: bootstrapSummary.roundsUsed
  })

  yield* logExampleStage("miprov2-stream-started", {
    numCandidates: 4,
    numTrials: 6,
    minibatch: false,
    seed: 17
  })

  const miproLog = yield* Ref.make(Arr.empty<MIPROv2.Event>())
  const compiled = yield* MIPROv2.runWithEvents(
    new MIPROv2.Options({
      module: planner,
      trainset,
      valset: evalset,
      metric: Metric.exactMatch("intervention"),
      numCandidates: 4,
      auto: Option.none(),
      minibatch: false,
      numTrials: 6,
      seed: 17
    }),
    (event) =>
      Ref.update(miproLog, Arr.append(event)).pipe(
        Effect.andThen(logExampleEvent("miprov2", MIPROv2.formatEvent(event).text))
      )
  )
  yield* Module.install(planner, compiled.parameters)
  const miproEvents = yield* Ref.get(miproLog)
  const miproEventSummary = MIPROv2.summarizeEvents(miproEvents)
  const optimized = yield* Evaluate.run(
    new Evaluate.Options({
      module: planner,
      examples: evalset,
      metrics,
      concurrency: 1
    })
  )
  const optimizedParameters = yield* Ref.get(planner.parameters)

  const baselineScore = baseline.overallScores.exactMatch ?? 0
  const optimizedScore = optimized.overallScores.exactMatch ?? 0
  const outcomeSummary = {
    eventSummary: miproEventSummary,
    baselineExactMatch: baselineScore,
    optimizedExactMatch: optimizedScore,
    scoreDelta: optimizedScore - baselineScore,
    demoCountBeforeOptimization: baselineParameters.demos.length,
    demoCountAfterOptimization: optimizedParameters.demos.length,
    demosLearnedDuringMIPROv2: optimizedParameters.demos.length - baselineParameters.demos.length
  }
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
        metricThreshold: 1
      },
      miprov2: {
        numCandidates: 4,
        numTrials: 6,
        minibatch: false,
        seed: 17
      }
    },
    trainsetSize: trainset.length,
    valsetSize: evalset.length,
    evalsetSize: evalset.length,
    instructionBefore: baselineParameters.instructions,
    instructionAfter: optimizedParameters.instructions,
    demoCountBefore: baselineParameters.demos.length,
    demoCountAfter: optimizedParameters.demos.length,
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
  }).pipe(Effect.provide(artifacts.artifactContextLayer))

  yield* logExampleStage("summary", {
    baselineExactMatch: outcomeSummary.baselineExactMatch,
    optimizedExactMatch: outcomeSummary.optimizedExactMatch,
    scoreDelta: outcomeSummary.scoreDelta,
    demoCountBeforeOptimization: outcomeSummary.demoCountBeforeOptimization,
    demoCountAfterOptimization: outcomeSummary.demoCountAfterOptimization,
    demosLearnedDuringMIPROv2: outcomeSummary.demosLearnedDuringMIPROv2,
    bootstrapLabeledCount: bootstrapSummary.labeledCount,
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
  withLiveLanguageModel(program).pipe(
    Effect.scoped,
    Effect.provide(Layer.merge(noopArtifactSinkLayer, BunServices.layer))
  )
)
