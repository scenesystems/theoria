/**
 * Batch inference with `Module.parallel`, optimization projections, and
 * artifact-envelope-ready evidence.
 *
 * Run: bun run examples/18-parallel-batch-mock.ts
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Layer, Schema } from "effect"
import { Module, Signature, Trace } from "effect-dsp"
import * as Contracts from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"

const program = Effect.gen(function*() {
  const signature = yield* Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )
  const baseModule = yield* Module.predict("qa-parallel-example-inner", signature)
  const parallel = yield* Module.parallel({
    name: "qa-parallel-example",
    module: baseModule,
    concurrency: 2
  })
  const execution = yield* Trace.withUsageTracking(
    Trace.withTracing(
      parallel.forward({
        inputs: [
          { question: "What is the capital of France?" },
          { question: "What is the capital of Japan?" },
          { question: "What is the capital of Kenya?" }
        ]
      }).pipe(
        Effect.provide(
          Layer.succeed(
            LanguageModel.LanguageModel,
            yield* MockLanguageModel.make(
              MockLanguageModel.sequence([
                { answer: "Paris" },
                { answer: "Tokyo" },
                { answer: "Nairobi" }
              ])
            ).pipe(Effect.map((mock) => mock.service))
          )
        )
      )
    )
  )
  const result = execution[0][0]
  const traces = execution[0][1]
  const usage = execution[1]
  const projections = yield* Effect.forEach(traces, Contracts.projectOptimizationObjective)
  const branchQuestions = Arr.map(projections, (projection) => String(projection.input.question ?? ""))
  const runId = yield* Schema.decode(Contracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
  const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.2.0")
  const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-05T00:00:00Z")
  const envelope = Contracts.Custom({
    schemaVersion: "artifact-envelope/v1",
    producer: Contracts.EffectDsp({
      packageVersion,
      component: ["examples", "18-parallel-batch-mock"],
      runId,
      optimizer: "parallel",
      metricName: "ordered-batch",
      exampleName: "18-parallel-batch-mock"
    }),
    lineage: new Contracts.ArtifactLineage({
      sourceRef: new Contracts.SourceRef({
        origin: "effect-dsp",
        domain: "example",
        segments: ["18-parallel-batch-mock"]
      }),
      artifactId: new Contracts.ArtifactId({ runId, sequence: 0 }),
      emittedAt
    }),
    payload: {
      outputs: Arr.map(result.outputs, (entry) => entry.answer),
      branchQuestions,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        callCount: usage.callCount,
        cachedCount: usage.cachedCount
      }
    }
  })

  yield* Effect.log("parallel-batch-mock", {
    result,
    projectionCount: projections.length,
    envelopeTag: envelope._tag
  })
})

BunRuntime.runMain(program)
