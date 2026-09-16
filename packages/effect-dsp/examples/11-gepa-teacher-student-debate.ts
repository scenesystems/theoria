/**
 * Uses GEPA to optimize a live judge module that receives separate teacher and
 * student analyses. An effectful metric supplies reflection feedback, and the
 * program compares baseline and optimized intervention labels.
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
import { Evaluate, Example, GEPA, Metric, Module, Signature } from "@scenesystems/effect-dsp"
import { Array as Arr, Boolean, Effect, Layer, Number, Option, Record, Ref, Schema, Stream, String } from "effect"
import {
  makeStandardEvents,
  makeStandardModuleState,
  makeStandardSummary,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { liveTeacherLayer, withLiveLanguageModel } from "./shared/live-provider-runtime.js"
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

const Recommendation = Schema.Struct({
  intervention: Signature.describe(Schema.String, "Final intervention: norms, incentives, or information"),
  rationale: Signature.describe(Schema.String, "Decision rationale that references both analysts")
})

const recommendationMetric = Metric.fromEffect(
  "recommendationExactMatchWithFeedback",
  (prediction: typeof Recommendation.Type, expected) =>
    Effect.sync(() => {
      const predictedIntervention = prediction.intervention
      const expectedIntervention = expected.intervention
      const correct = String.Equivalence(predictedIntervention, expectedIntervention)
      const score = Boolean.match(correct, { onTrue: () => 1, onFalse: () => 0 })
      const feedback = Boolean.match(correct, {
        onTrue: () => Arr.join(Arr.make("Correctly selected intervention '", expectedIntervention, "'."), ""),
        onFalse: () =>
          Arr.join(
            Arr.make(
              "Expected '",
              expectedIntervention,
              "' but produced '",
              predictedIntervention,
              "'. Prioritize mechanism-level fit over stylistic rhetoric."
            ),
            ""
          )
      })

      return new Metric.Result({
        score,
        feedback
      })
    })
)

const logExampleStage = (
  stage: string,
  payload: typeof Schema.Object.Type
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
    Recommendation.fields
  )

  const judgeSignature = yield* Signature.make(
    "Synthesize teacher and student analyses into one intervention decision. Return intervention as norms, incentives, or information.",
    {
      observation: Signature.describe(Schema.String, "Observed field behavior"),
      population: Signature.describe(Schema.String, "Studied population"),
      teacherArgument: Signature.describe(Schema.String, "Teacher analyst position"),
      studentArgument: Signature.describe(Schema.String, "Student analyst position")
    },
    Recommendation.fields
  )

  const teacherAnalyst = yield* Module.chainOfThought("teacher-analyst", analystSignature)
  const studentAnalyst = yield* Module.chainOfThought("student-analyst", analystSignature)
  const judge = yield* Module.predict("debate-judge", judgeSignature)
  const teacherLayer = yield* liveTeacherLayer()

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
          teacherArgument: Arr.join(Arr.make(teacherArgument.intervention, teacherArgument.argument), ": "),
          studentArgument: Arr.join(Arr.make(studentArgument.intervention, studentArgument.argument), ": ")
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
    evalExampleCount: Arr.length(evalset)
  })

  const baseline = yield* Evaluate.run({
    module: debateModule,
    examples: evalset,
    metrics: { exactMatch: recommendationMetric },
    concurrency: 1
  })
  const judgeParamsBeforeOptimization = yield* Ref.get(judge.params)

  yield* logExampleStage("gepa-stream-started", {
    trainExampleCount: Arr.length(trainset),
    maxIterations: 3,
    seed: 29
  })

  const gepaEventsChunk = yield* GEPA.stream({
    module: debateModule,
    trainset,
    valset: evalset,
    metric: recommendationMetric,
    maxIterations: 3,
    seed: 29
  }).pipe(
    GEPA.tapProgress((line) => logExampleEvent("gepa", line.text)),
    Stream.runCollect
  )

  const optimized = yield* Evaluate.run({
    module: debateModule,
    examples: evalset,
    metrics: { exactMatch: recommendationMetric },
    concurrency: 1
  })

  const gepaEvents = Arr.fromIterable(gepaEventsChunk)
  const gepaEventSummary = GEPA.summarizeEvents(gepaEvents)
  const judgeParams = yield* Ref.get(judge.params)
  const debateSavedState = yield* Module.save(debateModule)

  const baselineScore = Option.getOrElse(Record.get(baseline.overallScores, "exactMatch"), () => 0)
  const optimizedScore = Option.getOrElse(Record.get(optimized.overallScores, "exactMatch"), () => 0)
  const outcomeSummary = GEPA.summarizeOutcome({
    baselineScore,
    optimizedScore,
    instructionBefore: judgeParamsBeforeOptimization.instructions,
    instructionAfter: judgeParams.instructions,
    events: gepaEventSummary
  })
  const summaryArtifact = makeStandardSummary({
    exampleName: EXAMPLE_NAME,
    optimizer: "gepa",
    metricName: "recommendationExactMatchWithFeedback",
    baselineScore,
    optimizedScore,
    eventCount: Arr.length(gepaEvents),
    optimizationSummary: {
      gepa: gepaEventSummary,
      gepaOutcome: outcomeSummary
    },
    seed: 29,
    optimizationConfig: {
      maxIterations: 3,
      seed: 29
    },
    trainsetSize: Arr.length(trainset),
    valsetSize: Arr.length(evalset),
    evalsetSize: Arr.length(evalset),
    instructionBefore: judgeParamsBeforeOptimization.instructions,
    instructionAfter: judgeParams.instructions,
    demoCountBefore: Arr.length(judgeParamsBeforeOptimization.demos),
    demoCountAfter: Arr.length(judgeParams.demos),
    demosLearnedDuringOptimization: Number.subtract(
      Arr.length(judgeParams.demos),
      Arr.length(judgeParamsBeforeOptimization.demos)
    ),
    extras: {
      baseline,
      optimized,
      baselineDebateTurn,
      gepaEventSummary,
      outcomeSummary
    }
  })
  const eventsArtifact = makeStandardEvents({
    exampleName: EXAMPLE_NAME,
    optimizer: "gepa",
    streams: Arr.make({
      name: "gepa",
      events: gepaEvents
    })
  })
  const moduleStateArtifact = makeStandardModuleState({
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
    evolvedInstructionPreview: String.slice(0, 180)(judgeParams.instructions),
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
  withLiveLanguageModel(program).pipe(
    Effect.scoped,
    Effect.provide(Layer.merge(noopArtifactSinkLayer, BunContext.layer))
  )
)
