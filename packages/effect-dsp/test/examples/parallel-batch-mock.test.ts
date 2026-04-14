/**
 * Example contract: mock-backed parallel batch flow.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

describe("examples/18-parallel-batch-mock", () => {
  it.effect("emits ordered batch outputs plus artifact-envelope-ready evidence from one traced run", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make(
        "Answer questions with concise facts",
        {
          question: Signature.describe(Schema.String, "The question to answer")
        },
        {
          answer: Signature.describe(Schema.String, "A concise factual answer")
        }
      )
      const baseModule = yield* Module.predict("qa-parallel-example-test-inner", signature)
      const parallel = yield* Module.parallel({
        name: "qa-parallel-example-test",
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
              MockLanguageModel.layer(
                LanguageModel.LanguageModel,
                MockLanguageModel.sequence([
                  { answer: "Paris" },
                  { answer: "Tokyo" },
                  { answer: "Nairobi" }
                ])
              )
            )
          )
        )
      )
      const result = execution[0][0]
      const traces = execution[0][1]
      const usage = execution[1]
      const projections = yield* Effect.forEach(traces, Contracts.OptimizationObjectiveSurface.fromTraceEntry)
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
        lineage: Contracts.ArtifactLineage.make({
          sourceRef: Contracts.SourceRef.make({
            origin: "effect-dsp",
            domain: "example",
            segments: ["18-parallel-batch-mock"]
          }),
          artifactId: Contracts.ArtifactId.make({ runId, sequence: 0 }),
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
      const decoded = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(
        yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(envelope)
      )

      expect(result.outputs.map((entry) => entry.answer)).toStrictEqual(["Paris", "Tokyo", "Nairobi"])
      expect(branchQuestions).toStrictEqual([
        "What is the capital of France?",
        "What is the capital of Japan?",
        "What is the capital of Kenya?"
      ])
      expect(decoded).toStrictEqual(envelope)
    }))
})
