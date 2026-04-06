/**
 * Public trace evidence surface contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref, Schema } from "effect"
import { Module, Signature, Trace } from "effect-dsp"
import * as Contracts from "effect-dsp/contracts"
import { ModuleParams } from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"

const RAW_RESPONSE = "[[ ## answer ## ]]\nParis\n\n[[ ## completed ## ]]"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

const runPublicEvidenceFlow = Module.withDiscoveryScope(
  Effect.gen(function*() {
    const signature = yield* makeQaSignature()
    const module = yield* Module.predict("qa-public-evidence", signature)

    yield* Ref.update(
      module.params,
      (params) =>
        new ModuleParams({
          instructions: params.instructions,
          demos: params.demos,
          outputStrategy: "text"
        })
    )

    return yield* Trace.withUsageTracking(
      Trace.withTracing(
        module.forward({ question: "What is the capital of France?" }).pipe(
          Effect.provide(
            MockLanguageModel.layer(
              LanguageModel.LanguageModel,
              MockLanguageModel.fixed(RAW_RESPONSE)
            )
          )
        )
      )
    )
  })
)

describe("Trace public evidence surface", () => {
  it.effect("keeps prompt text, delimiter output, usage, and artifact serialization stable across deterministic replay", () =>
    Effect.gen(function*() {
      const first = yield* runPublicEvidenceFlow
      const second = yield* runPublicEvidenceFlow
      const firstTrace = first[0][1][0]!
      const secondTrace = second[0][1][0]!
      const firstProjection = yield* Contracts.projectOptimizationObjective(firstTrace)
      const secondProjection = yield* Contracts.projectOptimizationObjective(secondTrace)
      const encodedProjection = yield* Schema.encode(Contracts.OptimizationObjectiveSurface)(firstProjection)
      const encodedProjectionJson = yield* Schema.encode(Schema.parseJson(Schema.Unknown))(encodedProjection)
      const decodedProjection = yield* Schema.decode(Contracts.OptimizationObjectiveSurface)(encodedProjection)
      const runId = yield* Schema.decode(Contracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.2.0")
      const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-06T00:00:00Z")
      const envelope = Contracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer: Contracts.EffectDsp({
          packageVersion,
          component: ["Trace", "public-evidence-surface"],
          runId,
          optimizer: "trace",
          metricName: "public-evidence",
          exampleName: "public-evidence-surface"
        }),
        lineage: new Contracts.ArtifactLineage({
          sourceRef: new Contracts.SourceRef({
            origin: "effect-dsp",
            domain: "trace",
            segments: ["public-evidence-surface"]
          }),
          artifactId: new Contracts.ArtifactId({ runId, sequence: 0 }),
          emittedAt
        }),
        payload: {
          prompt: firstTrace.prompt,
          rawResponse: firstTrace.rawResponse,
          projection: encodedProjectionJson,
          usage: {
            inputTokens: first[1].inputTokens,
            outputTokens: first[1].outputTokens,
            totalTokens: first[1].inputTokens + first[1].outputTokens,
            callCount: first[1].callCount,
            cachedCount: first[1].cachedCount
          }
        }
      })
      const decodedEnvelope = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(
        yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(envelope)
      )

      expect(firstTrace.prompt).toContain("[[ ## question ## ]]")
      expect(firstTrace.rawResponse).toBe(RAW_RESPONSE)
      expect(firstTrace.output.answer).toBe("Paris")
      expect(firstProjection.output.answer).toBe("Paris")
      expect(firstProjection.rawResponse).toBe(RAW_RESPONSE)
      expect(firstProjection.totalTokens).toBe(0)
      expect(first[1].callCount).toBe(1)
      expect(first[1].cachedCount).toBe(0)
      expect(decodedProjection).toStrictEqual(firstProjection)
      expect(decodedEnvelope).toStrictEqual(envelope)
      expect({
        prompt: firstTrace.prompt,
        rawResponse: firstTrace.rawResponse,
        output: firstTrace.output,
        projection: firstProjection,
        usage: first[1]
      }).toStrictEqual({
        prompt: secondTrace.prompt,
        rawResponse: secondTrace.rawResponse,
        output: secondTrace.output,
        projection: secondProjection,
        usage: second[1]
      })
    }))
})
