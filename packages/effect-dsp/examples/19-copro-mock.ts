/**
 * Deterministic COPRO optimization with mock provider responses, typed
 * progress summaries, and effect-search-compatible study projections.
 *
 * Run: bun run examples/19-copro-mock.ts
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Option, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import * as Contracts from "effect-dsp/contracts"
import { ModuleParams } from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"
import {
  makeStandardEvents,
  makeStandardModuleState,
  makeStandardSummary,
  writeStandardArtifacts
} from "./shared/example-report-contract.js"
import { mockLanguageModelLayer } from "./shared/mock-language-model.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"

const EXAMPLE_NAME = "19-copro-mock"
const BASELINE_INSTRUCTION = "Answer questions with concise facts"
const IMPROVED_INSTRUCTION =
  "Answer questions with concise facts and verify the city against geographic knowledge."

const trainset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example.Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
)

const proposalForPrompt = (prompt: string) =>
  prompt.includes("COPRO seed instruction proposer") || prompt.includes("COPRO refinement instruction proposer")
    ? { instruction: IMPROVED_INSTRUCTION }
    : undefined

const answerForPrompt = (prompt: string) =>
  prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?") && prompt.includes(IMPROVED_INSTRUCTION)
    ? { answer: "Tokyo" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "London" }
    : { answer: "Unknown" }

const responseForPrompt = (prompt: string) => proposalForPrompt(prompt) ?? answerForPrompt(prompt)

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(EXAMPLE_NAME)
  const signature = yield* Signature.make(
    BASELINE_INSTRUCTION,
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )
  const module = yield* Module.predict("qa-copro-example", signature)
  const initialParams = yield* Ref.get(module.params)

  yield* Ref.set(
    module.params,
    new ModuleParams({
      instructions: initialParams.instructions,
      demos: initialParams.demos,
      outputStrategy: "structured"
    })
  )

  const baseline = yield* Evaluate.run({
    module,
    examples: trainset,
    metrics: {
      exactMatch: Metric.exactMatch("answer")
    },
    concurrency: 1
  }).pipe(Effect.provide(mockLanguageModelLayer(MockLanguageModel.map(responseForPrompt))))

  const snapshotRef = yield* Ref.make(Option.none<Optimizer.COPROSnapshot>())
  const events = yield* Stream.runCollect(
    Optimizer.coproStream({
      module,
      trainset,
      valset: trainset,
      metric: Metric.exactMatch("answer"),
      numCandidates: 3,
      maxSteps: 2,
      seed: 17,
      snapshotSink: (snapshot) => Ref.set(snapshotRef, Option.some(snapshot))
    })
  ).pipe(Effect.provide(mockLanguageModelLayer(MockLanguageModel.map(responseForPrompt))))
  const optimized = yield* Evaluate.run({
    module,
    examples: trainset,
    metrics: {
      exactMatch: Metric.exactMatch("answer")
    },
    concurrency: 1
  }).pipe(Effect.provide(mockLanguageModelLayer(MockLanguageModel.map(responseForPrompt))))

  const eventList = Arr.fromIterable(events)
  const summary = Optimizer.summarizeCOPROEvents(eventList)
  const optimizedParams = yield* Ref.get(module.params)
  const moduleState = yield* Module.save(module)
  const snapshotOption = yield* Ref.get(snapshotRef)
  const baselineScore = baseline.overallScores.exactMatch ?? 0
  const optimizedScore = optimized.overallScores.exactMatch ?? 0
  const runId = yield* Schema.decode(Contracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
  const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.2.0")
  const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-06T00:00:00Z")
  const studyEventTags = Option.match(snapshotOption, {
    onNone: () => Arr.empty<string>(),
    onSome: (snapshot) => Arr.map(Optimizer.projectCOPROStudyEvents(snapshot), (event) => event._tag)
  })
  const eventEnvelopeTag = Option.match(snapshotOption, {
    onNone: () => "none",
    onSome: (snapshot) =>
      Optimizer.coproStudyEventEnvelope({
        runId,
        packageVersion,
        emittedAt,
        metricName: "exactMatch",
        sequence: 0,
        event: Optimizer.projectCOPROStudyEvents(snapshot)[0]!
      })._tag
  })
  const snapshotEnvelopeTag = Option.match(snapshotOption, {
    onNone: () => "none",
    onSome: (snapshot) =>
      Optimizer.coproStudySnapshotEnvelope({
        runId,
        packageVersion,
        emittedAt,
        metricName: "exactMatch",
        sequence: 1,
        snapshot
      })._tag
  })
  const summaryArtifact = makeStandardSummary({
    exampleName: EXAMPLE_NAME,
    optimizer: "copro",
    metricName: "exactMatch",
    baselineScore,
    optimizedScore,
    eventCount: eventList.length,
    optimizationSummary: summary,
    seed: 17,
    optimizationConfig: {
      numCandidates: 3,
      maxSteps: 2,
      seed: 17
    },
    trainsetSize: trainset.length,
    valsetSize: trainset.length,
    evalsetSize: trainset.length,
    instructionBefore: BASELINE_INSTRUCTION,
    instructionAfter: optimizedParams.instructions,
    demoCountBefore: initialParams.demos.length,
    demoCountAfter: optimizedParams.demos.length,
    demosLearnedDuringOptimization: optimizedParams.demos.length - initialParams.demos.length,
    extras: {
      studyEventTags,
      eventEnvelopeTag,
      snapshotEnvelopeTag
    }
  })
  const eventsArtifact = makeStandardEvents({
    exampleName: EXAMPLE_NAME,
    optimizer: "copro",
    streams: Arr.make(
      { name: "copro", events: eventList },
      { name: "effect-search-study-events", events: studyEventTags }
    )
  })
  const moduleStateArtifact = makeStandardModuleState({
    exampleName: EXAMPLE_NAME,
    optimizer: "copro",
    state: moduleState
  })
  const artifactPaths = yield* writeStandardArtifacts({
    artifacts,
    summary: summaryArtifact,
    events: eventsArtifact,
    moduleState: moduleStateArtifact
  }).pipe(Effect.provide(artifacts.envelopeContextLayer))

  yield* Effect.log("copro-mock", {
    bestInstruction: optimizedParams.instructions,
    eventCount: eventList.length,
    bestScore: summary.bestScore,
    artifactPaths
  })
})

BunRuntime.runMain(
  program.pipe(
    Effect.provide(noopArtifactSinkLayer),
    Effect.provide(BunContext.layer)
  )
)
