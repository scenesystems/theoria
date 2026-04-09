import { describe, expect, it } from "@effect/vitest"
import { Effect, Redacted } from "effect"
import type { Layer } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as HuggingFace from "../../src/HuggingFace/index.js"

const assertLayer = <A, E, R>(_: Layer.Layer<A, E, R>): true => true

describe("HuggingFace/public-surface", () => {
  it("creates a normalized routed-provider route", () => {
    const route = HuggingFace.HuggingFaceRoutedRoute.make({
      baseUrl: "https://router.huggingface.co/v1",
      authMethod: "hf-token",
      selectionPolicy: Contracts.explicitProviderSelection("together")
    })

    expect(route.family).toBe("HuggingFace")
    expect(route.serveMode).toBe("routed-marketplace")
    expect(route.baseUrl).toBe("https://router.huggingface.co/v1")
    expect(
      assertLayer(
        HuggingFace.HuggingFaceRoutedLive({
          model: "meta-llama/Llama-3.3-70B-Instruct",
          baseUrl: route.baseUrl,
          accessToken: Redacted.make("hf_test_token"),
          selectionPolicy: route.selectionPolicy
        })
      )
    ).toBe(true)
    expect(
      assertLayer(
        HuggingFace.HuggingFaceRoutedEmbeddingsLive({
          model: "BAAI/bge-base-en-v1.5",
          route,
          accessToken: Redacted.make("hf_test_token")
        })
      )
    ).toBe(true)
    expect(HuggingFace.resolveLiveRuntime).toBeDefined()
    expect(HuggingFace.resolveLiveRuntimeConfig).toBeDefined()
    expect(HuggingFace.resolveLiveRuntimeFromConfig).toBeDefined()
    expect(HuggingFace.languageModelLayer).toBeDefined()
    expect(HuggingFace.embeddingModelLayer).toBeDefined()
  })

  it.effect("keeps the token on the live adapter boundary rather than in descriptor truth", () =>
    Effect.gen(function*() {
      const resolution = yield* HuggingFace.resolveLiveRuntime({
        serveMode: "routed-marketplace",
        model: "meta-llama/Llama-3.3-70B-Instruct",
        accessToken: Redacted.make("hf_test_token"),
        selectionPolicy: Contracts.explicitProviderSelection("together")
      })

      expect("accessToken" in resolution.desired).toBe(false)
      expect("accessToken" in resolution.resolvedRoute.route).toBe(false)
      expect(resolution.desired.route?.authMethod).toBe("hf-token")
    }))
})
