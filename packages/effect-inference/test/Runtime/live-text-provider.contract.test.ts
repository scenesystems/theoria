import type * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { ConfigProvider, Effect, Option, Redacted } from "effect"
import type { Layer } from "effect"

import type { InvalidRuntimeConfig } from "../../src/Errors/index.js"
import * as Runtime from "../../src/Runtime/index.js"

describe("Runtime/live-text-provider", () => {
  it.effect("builds direct hosted-provider descriptors and live layers from package-owned config helpers", () =>
    Effect.gen(function*() {
      const runtime = yield* Runtime.resolveLiveTextProviderRuntime(
        new Runtime.LiveTextProviderRuntimeOptions({
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: Redacted.make("test-key")
        })
      )

      expect(runtime.provider).toBe("openai")
      expect(Option.fromNullable(runtime.desired.route).pipe(Option.map((route) => route.family))).toEqual(
        Option.some("OpenAiResponses")
      )
      expect(Option.fromNullable(runtime.desired.route).pipe(Option.map((route) => route.baseUrl))).toEqual(
        Option.some("https://api.openai.com/v1")
      )
      expectTypeOf(runtime.languageModelLayer).toEqualTypeOf<Layer.Layer<LanguageModel.LanguageModel>>()
    }))

  it.effect("maps brokered openrouter config onto the stable OpenAI-compatible route family", () =>
    Effect.gen(function*() {
      const runtime = yield* Runtime.resolveLiveTextProviderRuntime(
        new Runtime.LiveTextProviderRuntimeOptions({
          provider: "openrouter",
          model: "openai/gpt-4o-mini",
          apiKey: Redacted.make("test-key"),
          apiUrl: "https://openrouter.ai/api/v1"
        })
      )

      expect(runtime.provider).toBe("openrouter")
      expect(Option.fromNullable(runtime.desired.route).pipe(Option.map((route) => route.family))).toEqual(
        Option.some("OpenAiCompatible")
      )
      expect(
        Option.fromNullable(runtime.desired.route).pipe(
          Option.flatMap((route) => Option.fromNullable(route.gatewayId))
        )
      ).toEqual(Option.some("openrouter"))
      expectTypeOf(Runtime.liveTextProviderLayer(
        new Runtime.LiveTextProviderRuntimeOptions({
          provider: "openrouter",
          model: "openai/gpt-4o-mini",
          apiKey: Redacted.make("test-key")
        })
      )).toEqualTypeOf<Layer.Layer<LanguageModel.LanguageModel, InvalidRuntimeConfig>>()
    }))

  it.effect("prefers provider-specific env overrides over generic DSP provider defaults", () =>
    Effect.gen(function*() {
      const config = yield* Runtime.resolveLiveTextProviderConfig(
        new Runtime.LiveTextProviderRuntimeOptions({
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
      )

      expect(config.model).toBe("provider-model")
      expect(Redacted.value(config.apiKey)).toBe("provider-key")
      expect(config.apiUrl).toEqual(Option.some("https://provider.example.com/v1"))
    }))

  it.effect("treats blank provider settings as absent instead of configured credentials", () =>
    Effect.gen(function*() {
      const config = yield* Runtime.resolveLiveTextProviderConfig(
        new Runtime.LiveTextProviderRuntimeOptions({
          provider: "openai",
          configProvider: ConfigProvider.fromJson({
            DSP_PROVIDER_API_KEY: "fallback-key",
            DSP_PROVIDER_MODEL: "fallback-model",
            OPENAI_API_KEY: "   ",
            OPENAI_MODEL: "   ",
            OPENAI_API_URL: "   "
          }).pipe(ConfigProvider.constantCase)
        })
      )

      expect(Redacted.value(config.apiKey)).toBe("fallback-key")
      expect(config.model).toBe("fallback-model")
      expect(config.apiUrl).toEqual(Option.none())
    }))

  it.effect("uses the explicit provider when selecting provider-specific config and its model default", () =>
    Effect.gen(function*() {
      const config = yield* Runtime.resolveLiveTextProviderConfig(
        new Runtime.LiveTextProviderRuntimeOptions({
          provider: "anthropic",
          configProvider: ConfigProvider.fromJson({
            DSP_PROVIDER: "not-a-provider",
            ANTHROPIC_API_KEY: "anthropic-key"
          }).pipe(ConfigProvider.constantCase)
        })
      )

      expect(config.provider).toBe("anthropic")
      expect(config.model).toBe("claude-3-5-haiku-latest")
      expect(Redacted.value(config.apiKey)).toBe("anthropic-key")
    }))

  it.effect("keeps missing credentials in the typed configuration failure channel", () =>
    Effect.gen(function*() {
      const error = yield* Runtime.resolveLiveTextProviderConfig(
        new Runtime.LiveTextProviderRuntimeOptions({
          provider: "openrouter",
          configProvider: ConfigProvider.fromJson({}).pipe(ConfigProvider.constantCase)
        })
      ).pipe(Effect.flip)

      expect(error._tag).toBe("effect-inference/InvalidRuntimeConfig")
      expect(error.reason).toBe(
        "Missing provider API key. Set DSP_PROVIDER_API_KEY or OPENROUTER_API_KEY."
      )
    }))
})
