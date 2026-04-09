/**
 * MIPROv2 streaming example with deterministic mock provider behavior.
 *
 * Run: bun run examples/06-optimize-miprov2-stream-mock.ts
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import { ModuleParams } from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"
import {
  StandardExampleEvents,
  StandardModuleState,
  StandardExampleSummary,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { mockLanguageModelLayer } from "./shared/mock-language-model.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"
import { withStudyCache } from "./shared/study-runtime.js"

const EXAMPLE_NAME = "06-optimize-miprov2-stream-mock"

const trainset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example.Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  }),
  new Example.Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const responseForPrompt = (prompt: string) =>
  prompt.includes("[miprov2-proposal:")
    ? "Answer with concise factual city names"
    : prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "Tokyo" }
    : prompt.includes("What is the capital of Italy?")
    ? { answer: "Rome" }
    : { answer: "Unknown" }

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(EXAMPLE_NAME)

  const qaSignature = yield* Signature.make(
    "Answer geography questions with concise city names",
    {
      question: Signature.describe(Schema.String, "Question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "Short factual answer")
    }
  )

  const qa = yield* Module.predict("qa-mipro-stream", qaSignature)
  const params = yield* Ref.get(qa.params)

  yield* Ref.set(
    qa.params,
    new ModuleParams({
      instructions: params.instructions,
      demos: params.demos,
      outputStrategy: "structured"
    })
  )

  const baseline = yield* Evaluate.run({
    module: qa,
    examples: trainset,
    metrics: {
      exactMatch: Metric.exactMatch("answer")
    },
    concurrency: 1
  })

  const events = yield* Stream.runCollect(
    Optimizer.miprov2Stream({
      module: qa,
      trainset,
      valset: trainset,
      metric: Metric.exactMatch("answer"),
      numCandidates: 3,
      numInstructions: 3,
      trialBudget: 4,
      seed: 21
    })
  )
  const optimized = yield* Evaluate.run({
    module: qa,
    examples: trainset,
    metrics: {
      exactMatch: Metric.exactMatch("answer")
    },
    concurrency: 1
  })

  const tags = Arr.map(Arr.fromIterable(events), (event) => event._tag)
  const optimizedParams = yield* Ref.get(qa.params)
  const qaSavedState = yield* Module.save(qa)
  const baselineScore = baseline.overallScores.exactMatch ?? 0
  const optimizedScore = optimized.overallScores.exactMatch ?? 0
  const summaryArtifact = StandardExampleSummary.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    metricName: "exactMatch",
    baselineScore,
    optimizedScore,
    eventCount: tags.length,
    optimizationSummary: {
      eventCount: tags.length,
      eventTags: tags
    },
    seed: 21,
    optimizationConfig: {
      numCandidates: 3,
      numInstructions: 3,
      trialBudget: 4,
      seed: 21
    },
    trainsetSize: trainset.length,
    valsetSize: trainset.length,
    evalsetSize: trainset.length,
    instructionBefore: params.instructions,
    instructionAfter: optimizedParams.instructions,
    demoCountBefore: params.demos.length,
    demoCountAfter: optimizedParams.demos.length,
    demosLearnedDuringOptimization: optimizedParams.demos.length - params.demos.length,
    extras: {
      baseline,
      optimized,
      eventTags: tags
    }
  })
  const eventsArtifact = StandardExampleEvents.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    streams: Arr.make({
      name: "miprov2",
      events: Arr.fromIterable(events)
    })
  })
  const moduleStateArtifact = StandardModuleState.make({
    exampleName: EXAMPLE_NAME,
    optimizer: "miprov2",
    state: qaSavedState
  })
  const artifactPaths = yield* writeStandardArtifacts({
    artifacts,
    summary: summaryArtifact,
    events: eventsArtifact,
    moduleState: moduleStateArtifact
  }).pipe(Effect.provide(artifacts.envelopeContextLayer))

  yield* Effect.log("optimize-miprov2-stream-mock", {
    eventCount: tags.length,
    eventTags: tags,
    artifactPaths
  })
})

BunRuntime.runMain(
  withStudyCache(
    program.pipe(
      Effect.provide(
        mockLanguageModelLayer(
          MockLanguageModel.map(responseForPrompt)
        )
      ),
      Effect.provide(noopArtifactSinkLayer),
      Effect.provide(BunContext.layer)
    ),
    "effect-dsp/examples/miprov2-stream"
  )
)
