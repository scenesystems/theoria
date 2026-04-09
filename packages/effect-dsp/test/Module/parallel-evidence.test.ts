/**
 * Module.parallel evidence contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

import { branchForPrompt, loadParallelConcurrencyFixture } from "../helpers/parallel-fixtures.js"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

describe("Module.parallel evidence surface", () => {
  it.effect("projects ordered branch evidence and aggregate outputs through stable optimization and artifact-envelope contracts", () =>
    Effect.gen(function*() {
      const fixture = yield* loadParallelConcurrencyFixture
      const signature = yield* conciseFactsQaSignature
      const inner = yield* Module.predict("qa-parallel-evidence-inner", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) => {
          const branch = branchForPrompt(fixture, prompt)

          return Effect.forEach(Arr.range(0, branch.yieldCount - 1), () => Effect.yieldNow(), { discard: true }).pipe(
            Effect.andThen({ answer: branch.answer })
          )
        })
      )
      const module = yield* Module.parallel({
        name: "qa-parallel-evidence",
        module: inner,
        concurrency: fixture.payload.concurrency,
        failurePolicy: fixture.payload.failurePolicy
      })
      const execution = yield* Trace.withUsageTracking(
        Trace.withTracing(
          module.forward({
            inputs: Arr.map(fixture.payload.branches, (branch) => ({ question: branch.question }))
          }).pipe(
            Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
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
          component: ["module", "parallel", "evidence"],
          runId,
          optimizer: "parallel",
          metricName: "ordered-batch",
          exampleName: "18-parallel-batch-mock"
        }),
        lineage: Contracts.ArtifactLineage.make({
          sourceRef: Contracts.SourceRef.make({
            origin: "effect-dsp",
            domain: "module",
            segments: ["parallel", "evidence"]
          }),
          artifactId: Contracts.ArtifactId.make({ runId, sequence: 0 }),
          emittedAt
        }),
        payload: {
          outputs: Arr.map(result.outputs, (entry) => entry.answer),
          branchQuestions,
          totalUsage: {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            callCount: usage.callCount,
            cachedCount: usage.cachedCount
          }
        }
      })
      const encodedEnvelope = yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(envelope)
      const decodedEnvelope = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(encodedEnvelope)

      expect(branchQuestions).toStrictEqual(
        Arr.map(fixture.payload.branches, (branch) => branch.question)
      )
      expect(result.outputs.map((entry) => entry.answer)).toStrictEqual(fixture.payload.expectedOutputAnswers)
      expect(usage.callCount).toBe(fixture.payload.expectedCallCount)
      expect(usage.cachedCount).toBe(fixture.payload.expectedCachedCount)
      expect(decodedEnvelope).toStrictEqual(envelope)
    }))
})
