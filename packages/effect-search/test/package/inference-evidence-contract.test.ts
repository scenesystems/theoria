import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, DateTime, Effect, Schema } from "effect"

import * as InferenceTesting from "../../../effect-inference/src/testing/index.js"

import * as Contracts from "../../src/contracts/index.js"

const testRunId = "01HZ0000000000000000000000"

const makeTestLineage = Effect.gen(function*() {
  const runId = yield* Schema.decode(Contracts.RunId)(testRunId)
  const sourceRef = new Contracts.SourceRef({
    origin: "effect-search",
    domain: "study",
    segments: ["inference-evidence"]
  })
  const artifactId = new Contracts.ArtifactId({
    runId,
    sequence: 0
  })

  return new Contracts.ArtifactLineage({
    sourceRef,
    artifactId,
    emittedAt: DateTime.unsafeMake("2024-01-01T00:00:00Z")
  })
})

const makeTestProducer = Effect.gen(function*() {
  const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.2.1")
  const runId = yield* Schema.decode(Contracts.RunId)(testRunId)
  const component = yield* Schema.decode(Contracts.ComponentPath)(["Study", "inferenceEvidence"])

  return Contracts.EffectSearch({
    packageVersion,
    component,
    runId
  })
})

describe("package/inference-evidence-contract", () => {
  it.effect("consumes route provenance and replay metadata from effect-inference fixtures without live adapters", () =>
    Effect.gen(function*() {
      const evidence = InferenceTesting.makeRuntimeEvidenceFixture({
        desired: {
          artifact: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" },
          route: {
            family: "HuggingFace",
            serveMode: "routed-marketplace",
            authMethod: "hf-token",
            baseUrl: "https://router.huggingface.co/v1"
          }
        },
        resolvedRuntime: InferenceTesting.makeResolvedRuntimeDescriptor({
          responseModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
          responseId: "resp_456"
        })
      })
      const lineage = yield* makeTestLineage
      const producer = yield* makeTestProducer
      const envelope = Contracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        payload: {
          requestedModel: evidence.desired.artifact.modelRef,
          routeFamily: evidence.resolvedRoute.route.family,
          responseModel: evidence.resolvedRuntime.responseModel
        }
      })
      const encoded = yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(envelope)

      expect(encoded._tag).toBe("Custom")

      if (encoded._tag !== "Custom") {
        return
      }

      const payload = encoded.payload

      if (typeof payload !== "object" || payload === null || Arr.isArray(payload)) {
        return
      }

      if (!("routeFamily" in payload) || !("responseModel" in payload)) {
        return
      }

      expect(payload.routeFamily).toBe("HuggingFace")
      expect(payload.responseModel).toBe("accounts/fireworks/models/llama-v3p3-70b-instruct")
    }))
})
