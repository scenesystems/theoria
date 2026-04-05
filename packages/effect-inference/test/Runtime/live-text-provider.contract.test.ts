import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Option, Redacted } from "effect"
import type { Layer } from "effect"

import * as Runtime from "../../src/Runtime/index.js"

const assertLayer = <A, E, R>(_: Layer.Layer<A, E, R>): true => true

describe("Runtime/live-text-provider", () => {
  it.effect("builds direct hosted-provider descriptors and live layers from package-owned config helpers", () =>
    Effect.gen(function*() {
      const runtime = yield* Runtime.resolveLiveTextProviderRuntime({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: Redacted.make("test-key")
      })

      expect(runtime.provider).toBe("openai")
      expect(runtime.desired.route?.family).toBe("OpenAiResponses")
      expect(runtime.desired.route?.baseUrl).toBe("https://api.openai.com/v1")
      expect(assertLayer(runtime.languageModelLayer)).toBe(true)
    }))

  it.effect("maps brokered openrouter config onto the stable OpenAI-compatible route family", () =>
    Effect.gen(function*() {
      const runtime = yield* Runtime.resolveLiveTextProviderRuntime({
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        apiKey: Redacted.make("test-key"),
        apiUrl: "https://openrouter.ai/api/v1"
      })

      expect(runtime.provider).toBe("openrouter")
      expect(runtime.desired.route?.family).toBe("OpenAiCompatible")
      expect(runtime.desired.route?.gatewayId).toBe("openrouter")
      expect(assertLayer(Runtime.liveTextProviderLayer({
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        apiKey: Redacted.make("test-key")
      }))).toBe(true)
    }))

  it.effect("prefers provider-specific env overrides over generic DSP provider defaults", () =>
    Effect.gen(function*() {
      const config = yield* Runtime.resolveLiveTextProviderConfig({
        provider: "openai",
        configProvider: ConfigProvider.fromJson({
          DSP_PROVIDER_MODEL: "global-model",
          OPENAI_MODEL: "provider-model",
          DSP_PROVIDER_API_KEY: "global-key",
          OPENAI_API_KEY: "provider-key",
          DSP_PROVIDER_API_URL: "https://global.example.com/v1",
          OPENAI_API_URL: "https://provider.example.com/v1"
        }).pipe(ConfigProvider.constantCase)
      })

      expect(config.model).toBe("provider-model")
      expect(Redacted.value(config.apiKey)).toBe("provider-key")
      expect(config.apiUrl).toEqual(Option.some("https://provider.example.com/v1"))
    }))
})
