/**
 * GEPA live optimization with teacher/student debate in a social-science setting.
 *
 * A teacher analyst and student analyst read the same observation and produce
 * competing recommendations. A judge module synthesizes the two positions into
 * a final intervention. GEPA then evolves the judge instructions using
 * feedback-rich metrics.
 *
 * This demonstrates:
 * - LLM-to-LLM interaction (teacher ↔ student ↔ judge)
 * - `Module.compose` for multi-agent orchestration
 * - Effectful metric feedback for GEPA reflection
 * - `Optimizer.gepaStream` event progression
 * - Baseline vs optimized evaluation on realistic intervention labels
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Optional env:
 *   DSP_PROVIDER=openai|anthropic|openrouter
 *   DSP_PROVIDER_MODEL=gpt-4o-mini
 *
 * Run: bun run examples/11-gepa-teacher-student-debate.ts
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

const EXAMPLE_NAME = "11-gepa-teacher-student-debate"

const trainset = Arr.make(
  new Example.Example({
    input: {
      observation:
        "Students under-report stress because they think everyone else is coping, and they avoid campus counseling.",
      population: "first-year undergraduates"
    },
    output: {
      intervention: "norms",
      rationale: "Norm correction can reduce misperceived stigma around help-seeking."
    }
  }),
  new Example.Example({
    input: {
      observation: "Factory operators complete safety recertification only after attendance bonuses are introduced.",
      population: "shift-based manufacturing workers"
    },
    output: {
      intervention: "incentives",
      rationale: "Behavior is tightly coupled to immediate compensation signals."
    }
  }),
  new Example.Example({
    input: {
      observation: "Caregivers skip nutrition workshops because materials are dense and schedules are hard to decode.",
      population: "low-income caregivers"
    },
    output: {
      intervention: "information",
      rationale: "Comprehension and access barriers dominate participation decisions."
    }
  }),
  new Example.Example({
    input: {
      observation: "Tenants recycle more when building lobbies show floor-level participation dashboards.",
      population: "urban apartment residents"
    },
    output: {
      intervention: "norms",
      rationale: "Visible social comparison cues raise compliance with pro-social behavior."
    }
  })
)

const evalset = Arr.make(
  new Example.Example({
    input: {
      observation:
        "Nurses adopt optional handoff checklists only when completion is tied to preferred shift assignments.",
      population: "hospital nursing teams"
    },
    output: {
      intervention: "incentives",
      rationale: "Tangible immediate rewards alter compliance behavior."
    }
  }),
  new Example.Example({
    input: {
      observation:
        "Community members join cleanup drives after weekly signs display how many neighbors already registered.",
      population: "mixed-income neighborhoods"
    },
    output: {
      intervention: "norms",
      rationale: "Descriptive norm visibility changes expectations about peer participation."
    }
  }),
  new Example.Example({
    input: {
      observation:
        "Parents miss telehealth follow-ups because appointment instructions use jargon and lack clear next steps.",
      population: "parents of pediatric patients"
    },
    output: {
      intervention: "information",
      rationale: "Clarity improvements reduce execution friction for follow-up behavior."
    }
  })
)

const recommendationMetric = Metric.fromEffect(
  "recommendationExactMatchWithFeedback",
  (prediction, expected) =>
    Effect.sync(() => {
      const predictedIntervention = Option.getOrElse(
        Option.fromNullable(prediction.intervention).pipe(Option.filter((value) => typeof value === "string")),
        () => ""
      )
      const expectedIntervention = Option.getOrElse(
        Option.fromNullable(expected.intervention).pipe(Option.filter((value) => typeof value === "string")),
        () => ""
      )

      const score = predictedIntervention === expectedIntervention
        ? 1
        : 0
      const feedback = predictedIntervention === expectedIntervention
        ? `Correctly selected intervention '${expectedIntervention}'.`
        : `Expected '${expectedIntervention}' but produced '${predictedIntervention}'. Prioritize mechanism-level fit over stylistic rhetoric.`

      return new Metric.Result({
        score,
        feedback
      })
    })
)

const logExampleStage = (
  stage: string,
  payload: Readonly<Record<string, unknown>>
) =>
  Effect.log("example:11 stage", {
    stage,
    ...payload
  })

const logExampleEvent = (
  optimizer: string,
  line: string
) =>
  Effect.log("example:11 optimizer event", {
    optimizer,
    line
  })

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(EXAMPLE_NAME)

  const analystSignature = yield* Signature.make(
    "Analyze an observed behavior pattern and propose one intervention label: norms, incentives, or information.",
    {
      observation: Signature.describe(Schema.String, "Observed behavior pattern from field data"),
      population: Signature.describe(Schema.String, "Population under study")
    },
    {
      intervention: Signature.describe(Schema.String, "One label: norms, incentives, or information"),
      argument: Signature.describe(Schema.String, "Short argument for the selected intervention")
    }
  )

  const panelSignature = yield* Signature.make(
    "Run a teacher/student intervention debate and return one final intervention decision.",
    {
      observation: Signature.describe(Schema.String, "Observed field behavior"),
      population: Signature.describe(Schema.String, "Studied population")
    },
    {
      intervention: Signature.describe(Schema.String, "Final intervention: norms, incentives, or information"),
      rationale: Signature.describe(Schema.String, "Decision rationale that references both analysts")
    }
  )

  const judgeSignature = yield* Signature.make(
    "Synthesize teacher and student analyses into one intervention decision. Return intervention as norms, incentives, or information.",
    {
      observation: Signature.describe(Schema.String, "Observed field behavior"),
      population: Signature.describe(Schema.String, "Studied population"),
      teacherArgument: Signature.describe(Schema.String, "Teacher analyst position"),
      studentArgument: Signature.describe(Schema.String, "Student analyst position")
    },
    {
      intervention: Signature.describe(Schema.String, "Final intervention: norms, incentives, or information"),
      rationale: Signature.describe(Schema.String, "Decision rationale that references both analysts")
    }
  )

  const teacherAnalyst = yield* Module.chainOfThought("teacher-analyst", analystSignature)
  const studentAnalyst = yield* Module.chainOfThought("student-analyst", analystSignature)
  const judge = yield* Module.predict("debate-judge", judgeSignature)
  const teacherLayer = liveLanguageModelLayer().pipe(Layer.orDie)

  const debateModule = yield* Module.compose({
    name: "intervention-debate-panel",
    signature: panelSignature,
    subModules: {
      teacherAnalyst,
      studentAnalyst,
      judge
    },
    forward: ({ input }) =>
      Effect.gen(function*() {
        const teacherArgument = yield* teacherAnalyst
          .forward({
            observation: input.observation,
            population: input.population
          })
          .pipe(Effect.provide(teacherLayer))

        const studentArgument = yield* studentAnalyst.forward({
          observation: input.observation,
          population: input.population
        })

        return yield* judge.forward({
          observation: input.observation,
          population: input.population,
          teacherArgument: `${teacherArgument.intervention}: ${teacherArgument.argument}`,
          studentArgument: `${studentArgument.intervention}: ${studentArgument.argument}`
        })
      })
  })

  const demoInput = {
    observation:
      "A volunteer blood drive doubled participation after neighborhood boards posted the number of already-registered donors.",
    population: "suburban households"
  }

  const baselineDebateTurn = yield* debateModule.forward(demoInput)

  yield* logExampleStage("baseline-turn", {
    intervention: baselineDebateTurn.intervention,
    rationale: baselineDebateTurn.rationale
  })

  yield* logExampleStage("baseline-evaluation-started", {
    evalExampleCount: evalset.length
  })

  const baseline = yield* Evaluate.run({
    module: debateModule,
    examples: evalset,
    metrics: { exactMatch: recommendationMetric },
    concurrency: 1
  })
  const judgeParamsBeforeOptimization = yield* Ref.get(judge.params)

  yield* logExampleStage("gepa-stream-started", {
    trainExampleCount: trainset.length,
    maxIterations: 3,
    seed: 29
  })

  const gepaEventsChunk = yield* Optimizer.gepaStream({
    module: debateModule,
    trainset,
    valset: evalset,
    metric: recommendationMetric,
    maxIterations: 3,
    seed: 29
  }).pipe(
    Optimizer.GEPAProgressLine.tap((line) => logExampleEvent("gepa", line.text)),
    Stream.runCollect
  )

  const optimized = yield* Evaluate.run({
    module: debateModule,
    examples: evalset,
    metrics: { exactMatch: recommendationMetric },
    concurrency: 1
  })

  const gepaEvents = Arr.fromIterable(gepaEventsChunk)
  const gepaEventSummary = Optimizer.GEPAEventSummary.summarize(gepaEvents)
  const judgeParams = yield* Ref.get(judge.params)
  const debateSavedState = yield* Module.save(debateModule)

  const baselineScore = baseline.overallScores.exactMatch ?? 0
  const optimizedScore = optimized.overallScores.exactMatch ?? 0
  const outcomeSummary = Optimizer.GEPAOutcomeSummary.make({
    baselineExactMatch: baselineScore,
    optimizedExactMatch: optimizedScore,
    instructionBeforeOptimization: judgeParamsBeforeOptimization.instructions,
    instructionAfterOptimization: judgeParams.instructions,
    eventSummary: gepaEventSummary
  })
  const summaryArtifact = StandardExampleSummary.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "gepa",
    metricName: "recommendationExactMatchWithFeedback",
    baselineScore,
    optimizedScore,
    eventCount: gepaEvents.length,
    optimizationSummary: {
      gepa: gepaEventSummary,
      gepaOutcome: outcomeSummary
    },
    seed: 29,
    optimizationConfig: {
      maxIterations: 3,
      seed: 29
    },
    trainsetSize: trainset.length,
    valsetSize: evalset.length,
    evalsetSize: evalset.length,
    instructionBefore: judgeParamsBeforeOptimization.instructions,
    instructionAfter: judgeParams.instructions,
    demoCountBefore: judgeParamsBeforeOptimization.demos.length,
    demoCountAfter: judgeParams.demos.length,
    demosLearnedDuringOptimization: judgeParams.demos.length - judgeParamsBeforeOptimization.demos.length,
    extras: {
      baseline,
      optimized,
      baselineDebateTurn,
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
    state: debateSavedState
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
    instructionChanged: outcomeSummary.instructionChanged,
    instructionLengthBeforeOptimization: outcomeSummary.instructionLengthBeforeOptimization,
    instructionLengthAfterOptimization: outcomeSummary.instructionLengthAfterOptimization,
    evolvedInstructionPreview: judgeParams.instructions.slice(0, 180),
    acceptanceEvaluatedCount: outcomeSummary.eventSummary.acceptanceEvaluatedCount,
    acceptanceAcceptedCount: outcomeSummary.eventSummary.acceptanceAcceptedCount,
    gate1PassedCount: outcomeSummary.eventSummary.gate1PassedCount,
    fullValsetEvaluatedCount: outcomeSummary.eventSummary.fullValsetEvaluatedCount,
    iterationWithAcceptedCandidateCount: outcomeSummary.eventSummary.iterationWithAcceptedCandidateCount,
    optimizationCompletedSeen: outcomeSummary.eventSummary.optimizationCompletedSeen,
    optimizationBestCandidateId: outcomeSummary.eventSummary.optimizationBestCandidateId,
    optimizationFrontierSize: outcomeSummary.eventSummary.optimizationFrontierSize,
    artifactPaths
  })
})

BunRuntime.runMain(
  withLiveLanguageModel(program).pipe(Effect.provide(noopArtifactSinkLayer), Effect.provide(BunContext.layer))
)
