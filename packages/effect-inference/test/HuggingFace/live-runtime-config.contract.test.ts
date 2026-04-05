import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Redacted } from "effect"

import * as HuggingFace from "../../src/HuggingFace/index.js"

describe("HuggingFace/live-runtime-config", () => {
  it.effect("decodes routed-provider config from env-backed settings with explicit overrides", () =>
    Effect.gen(function*() {
      const config = yield* HuggingFace.resolveLiveRuntimeConfig({
        serveMode: "routed-marketplace",
        model: "meta-llama/Llama-3.3-70B-Instruct",
        configProvider: ConfigProvider.fromJson({
          HUGGINGFACE_ACCESS_TOKEN: "hf_test_token",
          HUGGINGFACE_SELECTION_POLICY: "provider:together"
        }).pipe(ConfigProvider.constantCase)
      })

      expect(config.serveMode).toBe("routed-marketplace")
      expect(config.model).toBe("meta-llama/Llama-3.3-70B-Instruct")
      expect(Redacted.value(config.accessToken)).toBe("hf_test_token")
      expect(config.baseUrl).toBe("https://router.huggingface.co/v1")
      if (config.serveMode === "routed-marketplace") {
        expect(config.selectionPolicy).toEqual({ _tag: "provider", provider: "together" })
      }
    }))

  it.effect("decodes dedicated-endpoint config from env-backed settings and resolves a live runtime from it", () =>
    Effect.gen(function*() {
      const resolution = yield* HuggingFace.resolveLiveRuntimeFromConfig({
        serveMode: "dedicated-endpoint",
        model: "sentence-transformers/all-MiniLM-L6-v2",
        configProvider: ConfigProvider.fromJson({
          HUGGINGFACE_ACCESS_TOKEN: "hf_test_token",
          HUGGINGFACE_ENDPOINT_BASE_URL: "https://endpoint.example.com/v1",
          HUGGINGFACE_ENDPOINT_ID: "mini-lm-prod",
          HUGGINGFACE_DEPLOYMENT_ID: "endpoint-1",
          HUGGINGFACE_RUNTIME_FLAVOR: "tgi"
        }).pipe(ConfigProvider.constantCase)
      })

      expect(resolution.desired.route?.serveMode).toBe("dedicated-endpoint")
      expect(resolution.desired.route?.authMethod).toBe("hf-token")
      expect(resolution.resolvedRoute.route.endpointId).toBe("mini-lm-prod")
      expect(resolution.resolvedRoute.selectedDeployment).toBe("endpoint-1")
      expect(resolution.resolvedRoute.runtimeFlavor).toBe("tgi")
    }))
})
