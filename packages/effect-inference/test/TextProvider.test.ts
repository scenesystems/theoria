import type * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { ConfigProvider, Effect, Option, Redacted } from "effect"
import type { Layer } from "effect"

import type { InvalidRuntimeConfig } from "@scenesystems/effect-inference/InferenceError"
import * as TextProvider from "@scenesystems/effect-inference/TextProvider"

describe("TextProvider", () => {
  it.effect("uses provider-specific values before generic values and preserves redaction", () =>
    Effect.gen(function*() {
      const config = yield* TextProvider.fromConfig(
        new TextProvider.Options({
          provider: "openai",
          configProvider: ConfigProvider.fromJson({
            DSP_PROVIDER_MODEL: "generic-model",
            DSP_PROVIDER_API_KEY: "generic-key",
            OPENAI_MODEL: "provider-model",
            OPENAI_API_KEY: "provider-key",
            OPENAI_API_URL: "https://provider.example.test/v1"
          }).pipe(ConfigProvider.constantCase)
        })
      )

      expect(config.model).toBe("provider-model")
      expect(Redacted.value(config.apiKey)).toBe("provider-key")
      expect(config.apiUrl).toEqual(Option.some("https://provider.example.test/v1"))
    }))

  it.effect("lets explicit values win over provider-specific and generic configuration", () =>
    Effect.gen(function*() {
      const config = yield* TextProvider.fromConfig(
        new TextProvider.Options({
          provider: "openrouter",
          model: "explicit-model",
          apiKey: Redacted.make("explicit-key"),
          apiUrl: "https://explicit.example.test/v1",
          openrouterReferrer: "https://explicit-referrer.example.test",
          openrouterTitle: "Explicit title",
          configProvider: ConfigProvider.fromJson({
            DSP_PROVIDER_MODEL: "generic-model",
            DSP_PROVIDER_API_KEY: "generic-key",
            DSP_PROVIDER_API_URL: "https://generic.example.test/v1",
            DSP_PROVIDER_OPENROUTER_REFERRER: "https://generic-referrer.example.test",
            DSP_PROVIDER_OPENROUTER_TITLE: "Generic title",
            OPENROUTER_MODEL: "provider-model",
            OPENROUTER_API_KEY: "provider-key",
            OPENROUTER_API_URL: "https://provider.example.test/v1",
            OPENROUTER_REFERRER: "https://provider-referrer.example.test",
            OPENROUTER_TITLE: "Provider title"
          }).pipe(ConfigProvider.constantCase)
        })
      )

      expect(config.model).toBe("explicit-model")
      expect(Redacted.value(config.apiKey)).toBe("explicit-key")
      expect(config.apiUrl).toEqual(Option.some("https://explicit.example.test/v1"))
      expect(config.openrouterReferrer).toEqual(Option.some("https://explicit-referrer.example.test"))
      expect(config.openrouterTitle).toEqual(Option.some("Explicit title"))
    }))

  it.effect("builds the OpenRouter route and checked language-model layer", () =>
    Effect.gen(function*() {
      const runtime = yield* TextProvider.resolve(
        new TextProvider.Options({
          provider: "openrouter",
          model: "openai/gpt-4o-mini",
          apiKey: Redacted.make("explicit-key")
        })
      )
      const route = yield* Option.fromNullable(runtime.request.route)
      expect(route.family).toBe("OpenAiCompatible")
      expect(route.gatewayId).toBe("openrouter")
      expectTypeOf(runtime.languageModel).toEqualTypeOf<Layer.Layer<LanguageModel.LanguageModel>>()
      expectTypeOf(TextProvider.layerConfig(
        new TextProvider.Options({
          apiKey: Redacted.make("key")
        })
      )).toEqualTypeOf<Layer.Layer<LanguageModel.LanguageModel, InvalidRuntimeConfig>>()
    }))

  it.effect("treats blank provider settings as absent and falls back to generic values", () =>
    Effect.gen(function*() {
      const config = yield* TextProvider.fromConfig(
        new TextProvider.Options({
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

  it.effect("keeps missing credentials in the checked configuration channel", () =>
    Effect.gen(function*() {
      const error = yield* TextProvider.fromConfig(
        new TextProvider.Options({
          provider: "anthropic",
          configProvider: ConfigProvider.fromJson({}).pipe(ConfigProvider.constantCase)
        })
      ).pipe(Effect.flip)
      expect(error._tag).toBe("effect-inference/InvalidRuntimeConfig")
      expect(error.reason).toBe(
        "Missing provider API key. Set DSP_PROVIDER_API_KEY or ANTHROPIC_API_KEY."
      )
    }))
})
