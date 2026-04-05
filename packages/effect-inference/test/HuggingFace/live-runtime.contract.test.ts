import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Redacted } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as HuggingFace from "../../src/HuggingFace/index.js"

describe("HuggingFace/live-runtime", () => {
  it.effect("resolves routed-provider auth and live layers through one package-owned helper", () =>
    Effect.gen(function*() {
      const resolution = yield* HuggingFace.resolveLiveRuntime({
        serveMode: "routed-marketplace",
        model: "meta-llama/Llama-3.3-70B-Instruct",
        accessToken: Redacted.make("hf_test_token"),
        selectionPolicy: Contracts.explicitProviderSelection("together")
      })
      const languageModelLayer = yield* HuggingFace.languageModelLayer(resolution)
      const embeddingModelLayer = yield* HuggingFace.embeddingModelLayer(resolution)

      expect(resolution.desired.route?.family).toBe("HuggingFace")
      expect(resolution.desired.route?.serveMode).toBe("routed-marketplace")
      expect(resolution.desired.route?.authMethod).toBe("hf-token")
      expect(resolution.resolvedRoute.selectedProvider).toBe("together")
      expect(languageModelLayer).toBeDefined()
      expect(embeddingModelLayer).toBeDefined()
    }))

  it.effect("resolves dedicated-endpoint auth, endpoint identity, and embeddings through one package-owned helper", () =>
    Effect.gen(function*() {
      const resolution = yield* HuggingFace.resolveLiveRuntime({
        serveMode: "dedicated-endpoint",
        model: "sentence-transformers/all-MiniLM-L6-v2",
        accessToken: Redacted.make("hf_test_token"),
        baseUrl: "https://endpoint.example.com/v1",
        endpointId: "mini-lm-prod",
        deploymentId: "endpoint-1"
      })
      const embeddingModelLayer = yield* HuggingFace.embeddingModelLayer(resolution)

      expect(resolution.desired.route?.family).toBe("HuggingFace")
      expect(resolution.desired.route?.serveMode).toBe("dedicated-endpoint")
      expect(resolution.desired.route?.authMethod).toBe("hf-token")
      expect(resolution.resolvedRoute.route.endpointId).toBe("mini-lm-prod")
      expect(resolution.resolvedRoute.selectedDeployment).toBe("endpoint-1")
      expect(embeddingModelLayer).toBeDefined()
    }))

  it.effect("resolves routed-provider auth and live layers from env-backed config helpers", () =>
    Effect.gen(function*() {
      const resolution = yield* HuggingFace.resolveLiveRuntimeFromConfig({
        serveMode: "routed-marketplace",
        model: "meta-llama/Llama-3.3-70B-Instruct",
        configProvider: ConfigProvider.fromJson({
          HUGGINGFACE_ACCESS_TOKEN: "hf_test_token",
          HUGGINGFACE_SELECTION_POLICY: "fastest"
        }).pipe(ConfigProvider.constantCase)
      })

      expect(resolution.desired.route?.serveMode).toBe("routed-marketplace")
      expect(resolution.desired.route?.authMethod).toBe("hf-token")
      expect(resolution.resolvedRoute.selectionReason).toBeDefined()
    }))
})
