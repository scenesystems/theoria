import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import type { Layer } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as Runtime from "../../src/Runtime/index.js"
import * as Testing from "../../src/testing/index.js"

const assertLayer = <A, E, R>(_: Layer.Layer<A, E, R>): true => true

describe("Testing/testing-surface", () => {
  it.effect("ships deterministic fixtures and resolver doubles for downstream package tests", () =>
    Effect.gen(function*() {
      const desired: Contracts.DesiredRuntimeDescriptor = {
        artifact: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" },
        route: {
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1",
          selectionPolicy: Contracts.explicitProviderSelection("together")
        }
      }

      const resolution = Testing.makeRuntimeResolution({ desired })
      const evidence = Testing.makeRuntimeEvidenceFixture({
        desired,
        resolvedRuntime: Testing.makeResolvedRuntimeDescriptor({
          responseModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
          responseId: "resp_123"
        })
      })
      const resolver = yield* Runtime.RuntimeResolver.pipe(
        Effect.provide(Testing.staticRuntimeResolver(resolution))
      )
      const resolved = yield* resolver.resolve(desired)
      const desiredFixture = Testing.makeDesiredRuntimeDescriptor({
        modelRef: desired.artifact.modelRef,
        ...Option.fromNullable(desired.route).pipe(
          Option.match({
            onNone: () => ({}),
            onSome: (route) => ({ route })
          })
        )
      })
      const resolvedRoute = Testing.makeResolvedRouteDescriptor({ desired })

      expect(resolved.resolvedRoute.selectionReason).toBe("testing-static-resolution")
      expect(evidence.resolvedRuntime.responseId).toBe("resp_123")
      expect(desiredFixture.artifact.modelRef).toBe(desired.artifact.modelRef)
      expect(resolvedRoute.providerModel).toBe(desired.artifact.modelRef)
      expect(Testing.emptyTestingLayers().languageModel._tag).toBe("None")
      expect(assertLayer(Testing.staticLanguageModel("Paris"))).toBe(true)
      expect(assertLayer(Testing.staticEmbeddingModel([1, 2, 3]))).toBe(true)
    }))
})
