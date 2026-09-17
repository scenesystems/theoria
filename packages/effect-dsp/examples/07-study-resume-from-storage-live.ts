/**
 * Resumes a persisted search that tunes an effect-dsp module with a live
 * language model.
 *
 * The first study leg writes trials through `StudyStorage`; the resumed leg
 * reloads that state and evaluates two more instruction and demonstration
 * candidates.
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Optional env:
 *   DSP_PROVIDER=openai|anthropic|openrouter
 *   DSP_PROVIDER_MODEL=gpt-4o-mini
 *
 * Run: bun run examples/07-study-resume-from-storage-live.ts
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Evaluate, Example, Metric, Module, Signature } from "@scenesystems/effect-dsp"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import * as Optimization from "@scenesystems/effect-search/Optimization"
import * as Sampler from "@scenesystems/effect-search/Sampler"
import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import * as ArtifactSink from "@scenesystems/effect-study/ArtifactSink"
import { Array as Arr, Effect, Layer, Match, Number as Num, Option, Ref, Schema, Stream } from "effect"
import {
  makeStandardEvents,
  makeStandardModuleState,
  makeStandardSummary,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { withLiveLanguageModel } from "./shared/live-provider-runtime.js"
import { createExampleArtifacts } from "./shared/output-artifacts.js"
import { studyCacheLayer, studyStorageLayer, withStudyProgress } from "./shared/study-runtime.js"

const EXAMPLE_NAME = "07-study-resume-from-storage-live"

const italyEvalset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const franceDemo = new Example.Demo({
  input: { question: "What is the capital of France?" },
  output: { answer: "Paris" }
})

const japanDemo = new Example.Demo({
  input: { question: "What is the capital of Japan?" },
  output: { answer: "Tokyo" }
})

const instructionCandidate = (index: number): string =>
  Match.value(index).pipe(
    Match.when(0, () => "Answer geography questions with concise city names"),
    Match.when(1, () => "Answer with canonical capital city names only"),
    Match.orElse(() => "Use provided demonstrations to infer the correct city")
  )

const demoCandidate = (index: number) =>
  Match.value(index).pipe(
    Match.when(0, () => Arr.empty()),
    Match.when(1, () => Arr.make(franceDemo)),
    Match.orElse(() => Arr.make(franceDemo, japanDemo))
  )

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(EXAMPLE_NAME)
  const languageModel = yield* LanguageModel.LanguageModel
  const studyLayer = Layer.provideMerge(
    Layer.merge(
      studyStorageLayer(artifacts.storageDir),
      studyCacheLayer("effect-dsp/examples/study-resume")
    ),
    Layer.merge(
      ArtifactSink.layerFileSystem(artifacts.storageDir),
      artifacts.artifactContextLayer
    )
  )

  const qaSignature = yield* Signature.make(
    "Answer geography questions with concise city names",
    {
      question: Signature.describe(Schema.String, "Question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "Short factual answer")
    }
  )
  const qa = yield* Module.predict("qa-study-resume", qaSignature)

  const space = yield* SearchSpace.make({
    instructionIndex: SearchSpace.int(0, 2),
    demoIndex: SearchSpace.int(0, 2)
  })

  const objective = (raw: unknown) =>
    Effect.gen(function*() {
      const config = yield* Schema.decodeUnknown(space.schema)(raw)

      yield* Ref.set(
        qa.params,
        new ModuleParams({
          instructions: instructionCandidate(config.instructionIndex),
          demos: demoCandidate(config.demoIndex),
          outputStrategy: "structured"
        })
      )

      const report = yield* Evaluate.run({
        module: qa,
        examples: italyEvalset,
        metrics: {
          exactMatch: Metric.exactMatch("answer")
        },
        concurrency: 1
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, languageModel))

      return Option.getOrElse(
        Option.fromNullable(report.overallScores.exactMatch),
        () => 0
      )
    })

  const firstLegEvents = yield* Stream.runCollect(
    withStudyProgress(
      Optimization.stream({
        space,
        sampler: Sampler.random({ seed: 64 }),
        direction: "maximize",
        trials: 3,
        objective
      })
    ).pipe(Stream.provideLayer(studyLayer))
  )

  const resumedEvents = yield* Stream.runCollect(
    withStudyProgress(
      Optimization.resumeFromStorageStream({
        space,
        sampler: Sampler.random({ seed: 64 }),
        direction: "maximize",
        trials: 2,
        objective
      })
    ).pipe(Stream.provideLayer(studyLayer))
  )

  const firstLegTags = Arr.map(Arr.fromIterable(firstLegEvents), (event) => event._tag)
  const resumedTags = Arr.map(Arr.fromIterable(resumedEvents), (event) => event._tag)
  const resumedLastEvent = Option.getOrElse(Arr.last(resumedTags), () => "none")
  const optimized = yield* Evaluate.run({
    module: qa,
    examples: italyEvalset,
    metrics: {
      exactMatch: Metric.exactMatch("answer")
    },
    concurrency: 1
  })
  const optimizedParams = yield* Ref.get(qa.params)
  const moduleSavedState = yield* Module.save(qa)
  const optimizedScore = Option.getOrElse(
    Option.fromNullable(optimized.overallScores.exactMatch),
    () => 0
  )
  const summaryArtifact = makeStandardSummary({
    exampleName: EXAMPLE_NAME,
    optimizer: "study",
    metricName: "exactMatch",
    baselineScore: 0,
    optimizedScore,
    eventCount: Num.sum(Arr.length(firstLegTags), Arr.length(resumedTags)),
    optimizationSummary: {
      firstLegEventCount: Arr.length(firstLegTags),
      resumedEventCount: Arr.length(resumedTags),
      resumedLastEvent
    },
    optimizationConfig: {
      storageDirectory: artifacts.storageDir,
      firstLegTrials: 3,
      resumedTrials: 2,
      seed: 64
    },
    evalsetSize: Arr.length(italyEvalset),
    instructionAfter: optimizedParams.instructions,
    demoCountAfter: Arr.length(optimizedParams.demos),
    extras: {
      optimized,
      firstLegEventTags: firstLegTags,
      resumedEventTags: resumedTags
    }
  })
  const eventsArtifact = makeStandardEvents({
    exampleName: EXAMPLE_NAME,
    optimizer: "study",
    streams: Arr.make(
      {
        name: "optimization.stream",
        events: Arr.fromIterable(firstLegEvents)
      },
      {
        name: "optimization.resumeFromStorageStream",
        events: Arr.fromIterable(resumedEvents)
      }
    )
  })
  const moduleStateArtifact = makeStandardModuleState({
    exampleName: EXAMPLE_NAME,
    optimizer: "study",
    state: moduleSavedState
  })
  const artifactPaths = yield* writeStandardArtifacts({
    artifacts,
    summary: summaryArtifact,
    events: eventsArtifact,
    moduleState: moduleStateArtifact
  }).pipe(Effect.provide(studyLayer))

  yield* Effect.log("study-resume-from-storage", {
    storageDirectory: artifacts.storageDir,
    firstLegEventCount: Arr.length(firstLegTags),
    resumedEventCount: Arr.length(resumedTags),
    resumedLastEvent,
    artifactPaths
  })
})

BunRuntime.runMain(
  withLiveLanguageModel(program).pipe(
    Effect.provide(BunContext.layer)
  )
)
