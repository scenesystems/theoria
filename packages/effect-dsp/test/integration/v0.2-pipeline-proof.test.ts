/**
 * v0.2 module -> optimizer -> evaluation integration proof.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature, Trace } from "effect-dsp"
import * as Contracts from "effect-dsp/contracts"
import { ModuleParams } from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"

const BASELINE_INSTRUCTION = "Answer questions with concise facts"
const IMPROVED_INSTRUCTION = "Answer questions with concise facts and verify the city against geographic knowledge."

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

const responseForPrompt = (prompt: string) =>
  prompt.includes("COPRO seed instruction proposer") || prompt.includes("COPRO refinement instruction proposer")
    ? { instruction: IMPROVED_INSTRUCTION }
    : prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?") && prompt.includes(IMPROVED_INSTRUCTION)
    ? { answer: "Tokyo" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "London" }
    : { answer: "Unknown" }

const mockLanguageModelLayer = MockLanguageModel.layer(
  LanguageModel.LanguageModel,
  MockLanguageModel.map(responseForPrompt)
)

type QaModule = Effect.Effect.Success<typeof makeModule>

const makeModule = Effect.gen(function*() {
  const signature = yield* Signature.make(
    BASELINE_INSTRUCTION,
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )
  const module = yield* Module.predict("qa-v0-2-pipeline", signature)
  const initialParams = yield* Ref.get(module.params)

  yield* Ref.set(
    module.params,
    new ModuleParams({
      instructions: initialParams.instructions,
      demos: initialParams.demos,
      outputStrategy: "structured"
    })
  )

  return module
})

const evaluateWithEvidence = (module: QaModule) =>
  Module.withDiscoveryScope(
    Trace.withUsageTracking(
      Trace.withTracing(
        Evaluate.run({
          module,
          examples: trainset,
          metrics: {
            exactMatch: Metric.exactMatch("answer")
          },
          concurrency: 1
        }).pipe(Effect.provide(mockLanguageModelLayer))
      )
    )
  )

const projectModuleEvidence = (moduleName: string, traces: ReadonlyArray<Trace.Entry>) =>
  Effect.forEach(
    Arr.filter(traces, (trace) => trace.moduleName === moduleName),
    Contracts.projectOptimizationObjective
  )

const runPipeline = Effect.gen(function*() {
  const module = yield* makeModule
  const baselineState = yield* Module.save(module)
  const baselineExecution = yield* evaluateWithEvidence(module)
  const baselineReport = baselineExecution[0][0]
  const baselineTraces = baselineExecution[0][1]
  const baselineUsage = baselineExecution[1]
  const baselineEvidence = yield* projectModuleEvidence(module.name, baselineTraces)
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
  ).pipe(Effect.provide(mockLanguageModelLayer))
  const optimizedState = yield* Module.save(module)
  const optimizedExecution = yield* evaluateWithEvidence(module)
  const optimizedReport = optimizedExecution[0][0]
  const optimizedTraces = optimizedExecution[0][1]
  const optimizedUsage = optimizedExecution[1]
  const optimizedEvidence = yield* projectModuleEvidence(module.name, optimizedTraces)
  const snapshot = yield* Ref.get(snapshotRef).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.die("missing-copro-snapshot"),
        onSome: Effect.succeed
      })
    )
  )
  const replayModule = yield* makeModule

  yield* Module.load(replayModule, optimizedState)

  const replayExecution = yield* evaluateWithEvidence(replayModule)
  const replayReport = replayExecution[0][0]
  const replayEvidence = yield* projectModuleEvidence(replayModule.name, replayExecution[0][1])
  const decodedEvents = yield* Schema.decodeUnknown(Schema.Array(Optimizer.COPROEventSchema))(Arr.fromIterable(events))
  const summary = Optimizer.summarizeCOPROEvents(decodedEvents)
  const studyEvents = Optimizer.projectCOPROStudyEvents(snapshot)
  const studySnapshot = Optimizer.projectCOPROStudySnapshot(snapshot)
  const runId = yield* Schema.decode(Contracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
  const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.2.0")
  const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-06T00:00:00Z")
  const eventEnvelope = Optimizer.coproStudyEventEnvelope({
    runId,
    packageVersion,
    emittedAt,
    metricName: "exactMatch",
    sequence: 0,
    event: studyEvents[0]!
  })
  const snapshotEnvelope = Optimizer.coproStudySnapshotEnvelope({
    runId,
    packageVersion,
    emittedAt,
    metricName: "exactMatch",
    sequence: 1,
    snapshot
  })
  const decodedEventEnvelope = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(
    yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(eventEnvelope)
  )
  const decodedSnapshotEnvelope = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(
    yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(snapshotEnvelope)
  )

  return {
    baselineState,
    baselineReport,
    baselineUsage,
    baselineEvidence,
    optimizedState,
    optimizedReport,
    optimizedUsage,
    optimizedEvidence,
    replayReport,
    replayEvidence,
    summary,
    studyEvents,
    studySnapshot,
    decodedEventEnvelope,
    decodedSnapshotEnvelope,
    eventEnvelope,
    snapshotEnvelope
  }
})

describe("integration/v0.2-pipeline-proof", () => {
  it.effect("proves the v0.2 pipeline composes through COPRO, saved state, study snapshots, and replay-safe evidence", () =>
    Effect.gen(function*() {
      const result = yield* runPipeline
      const baselineExactMatch = result.baselineReport.overallScores.exactMatch ?? 0
      const optimizedExactMatch = result.optimizedReport.overallScores.exactMatch ?? 0

      expect(baselineExactMatch).toBe(0.5)
      expect(optimizedExactMatch).toBe(1)
      expect(optimizedExactMatch).toBeGreaterThanOrEqual(baselineExactMatch)
      expect(result.summary.completed).toBe(true)
      expect(result.summary.bestScore).toBe(1)
      expect(result.baselineEvidence).toHaveLength(trainset.length)
      expect(result.optimizedEvidence).toHaveLength(trainset.length)
      expect(result.optimizedEvidence.every((projection) => projection.totalTokens >= 0)).toBe(true)
      expect(result.optimizedUsage.callCount).toBeGreaterThan(0)
      expect(result.optimizedUsage.inputTokens + result.optimizedUsage.outputTokens).toBeGreaterThanOrEqual(0)
      expect(result.studyEvents.at(-1)?._tag).toBe("StudyCompleted")
      expect(result.studySnapshot.completedCount).toBeGreaterThan(0)
      expect(result.decodedEventEnvelope).toStrictEqual(result.eventEnvelope)
      expect(result.decodedSnapshotEnvelope).toStrictEqual(result.snapshotEnvelope)
      expect(result.replayReport).toStrictEqual(result.optimizedReport)
      expect(result.replayEvidence).toStrictEqual(result.optimizedEvidence)
      expect(result.optimizedState).not.toStrictEqual(result.baselineState)
    }))
})
