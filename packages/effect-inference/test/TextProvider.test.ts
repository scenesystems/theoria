import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import {
  Array as Arr,
  ConfigProvider,
  Data,
  Effect,
  Match,
  Option,
  Redacted,
  Ref,
  Schema,
  Stream,
  String
} from "effect"
import type { Layer } from "effect"
import { AiError, LanguageModel } from "effect/ai"
import { HttpClient, type HttpClientRequest, HttpClientResponse, HttpServerResponse } from "effect/http"

import type { InvalidRuntimeConfig } from "@scenesystems/effect-inference/InferenceError"
import * as TextProvider from "@scenesystems/effect-inference/TextProvider"

const capturedTransport = Effect.gen(function*() {
  const requests = yield* Ref.make(Arr.empty<HttpClientRequest.HttpClientRequest>())
  const client = HttpClient.make((request) =>
    Ref.update(requests, Arr.append(request)).pipe(Effect.as(
      HttpClientResponse.fromWeb(request, HttpServerResponse.toWeb(HttpServerResponse.text("test", { status: 400 })))
    ))
  )
  return { requests, client }
})

const serializedBody = (request: HttpClientRequest.HttpClientRequest) =>
  Match.value(request.body).pipe(
    Match.tag("Uint8Array", (body) =>
      Stream.fromIterable([body.body]).pipe(
        Stream.decodeText,
        Stream.runFold(() => "", String.concat),
        Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))))
      )),
    Match.orElse(() => Effect.sync(() => expect.fail("expected a serialized JSON request body")))
  )

const isolated = (provider: TextProvider.Provider, defaults: ModelSettings) =>
  new TextProvider.Options({
    provider,
    model: "test-model",
    defaults,
    apiKey: Redacted.make("test"),
    configProvider: ConfigProvider.fromUnknown({}).pipe(ConfigProvider.constantCase)
  })

class UnsupportedDefault extends Data.Class<{
  readonly provider: TextProvider.Provider
  readonly defaults: ModelSettings
  readonly parameter: string
}> {}

class SupportedDefaults extends Data.Class<{
  readonly provider: TextProvider.Provider
  readonly defaults: ModelSettings
  readonly fields: ReadonlyArray<string>
  readonly expected: ReadonlyArray<Option.Option<unknown>>
}> {}

describe("TextProvider", () => {
  it.effect("decodes model defaults and lets explicit settings replace configured defaults", () =>
    Effect.gen(function*() {
      const configProvider = ConfigProvider.fromUnknown({
        DSP_MODEL_SETTINGS: "{\"temperature\":0.2,\"maxTokens\":73}"
      }).pipe(ConfigProvider.constantCase)
      const configured = yield* TextProvider.fromConfig(
        new TextProvider.Options({ provider: "openai", apiKey: Redacted.make("test"), configProvider })
      )
      expect(configured.defaults).toEqual(new ModelSettings({ temperature: 0.2, maxTokens: 73 }))
      const explicit = yield* TextProvider.fromConfig(
        new TextProvider.Options({
          provider: "openai",
          apiKey: Redacted.make("test"),
          configProvider,
          defaults: new ModelSettings({ temperature: 0.7 })
        })
      )
      expect(explicit.defaults).toEqual(new ModelSettings({ temperature: 0.7 }))
    }))

  it.effect("uses provider-specific values before generic values and preserves redaction", () =>
    Effect.gen(function*() {
      const config = yield* TextProvider.fromConfig(
        new TextProvider.Options({
          provider: "openai",
          configProvider: ConfigProvider.fromUnknown({
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
          configProvider: ConfigProvider.fromUnknown({
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
      const route = yield* Effect.fromOption(Option.fromNullishOr(runtime.request.route))
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
          configProvider: ConfigProvider.fromUnknown({
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
          configProvider: ConfigProvider.fromUnknown({}).pipe(ConfigProvider.constantCase)
        })
      ).pipe(Effect.flip)
      expect(error._tag).toBe("effect-inference/InvalidRuntimeConfig")
      expect(error.reason).toBe(
        "SourceError: Missing provider API key. Set DSP_PROVIDER_API_KEY or ANTHROPIC_API_KEY."
      )
    }))

  it.effect("fails every direct-layer operation before transport when configured defaults are unsupported", () =>
    Effect.forEach([
      new UnsupportedDefault({ provider: "openai", defaults: new ModelSettings({ stop: ["END"] }), parameter: "stop" }),
      new UnsupportedDefault({ provider: "openai", defaults: new ModelSettings({ seed: 7 }), parameter: "seed" }),
      new UnsupportedDefault({ provider: "openai", defaults: new ModelSettings({ stop: [] }), parameter: "stop" }),
      new UnsupportedDefault({ provider: "anthropic", defaults: new ModelSettings({ seed: 0 }), parameter: "seed" })
    ], (testCase) =>
      Effect.gen(function*() {
        const { requests, client } = yield* capturedTransport
        const options = isolated(testCase.provider, testCase.defaults)
        const runtime = yield* TextProvider.resolve(options)
        expect(runtime.defaults).toEqual(testCase.defaults)
        const constraint = `${testCase.provider} API does not support ${testCase.parameter}`
        const expected = (method: string) =>
          AiError.make({
            module: "@scenesystems/effect-inference/TextProvider",
            method,
            reason: new AiError.InvalidRequestError({
              parameter: testCase.parameter,
              constraint,
              description: constraint
            })
          })
        const failures = yield* Effect.forEach(
          [runtime.languageModel, TextProvider.layerConfig(options)],
          (layer) =>
            Effect.all([
              LanguageModel.generateText({ prompt: "hello" }).pipe(Effect.flip),
              LanguageModel.generateObject({ prompt: "hello", schema: Schema.Struct({ answer: Schema.String }) }).pipe(
                Effect.flip
              ),
              LanguageModel.streamText({ prompt: "hello" }).pipe(Stream.runDrain, Effect.flip)
            ]).pipe(Effect.provide(layer))
        ).pipe(Effect.provideService(HttpClient.HttpClient, client))
        expect(failures).toEqual(Arr.replicate([
          expected("generateText"),
          expected("generateObject"),
          expected("streamText")
        ], 2))
        expect(yield* Ref.get(requests)).toEqual([])
      })))

  it.effect("serializes every supported configured default through the direct provider layer", () =>
    Effect.forEach([
      new SupportedDefaults({
        provider: "openai",
        defaults: new ModelSettings({ temperature: 0.3, maxTokens: 11, topP: 0.9 }),
        fields: ["temperature", "max_output_tokens", "top_p", "stop", "seed"],
        expected: [Option.some(0.3), Option.some(11), Option.some(0.9), Option.none(), Option.none()]
      }),
      new SupportedDefaults({
        provider: "anthropic",
        defaults: new ModelSettings({ temperature: 0.3, maxTokens: 11, topP: 0.9, stop: ["END"] }),
        fields: ["temperature", "max_tokens", "top_p", "stop_sequences", "seed"],
        expected: [Option.some(0.3), Option.some(11), Option.some(0.9), Option.some(["END"]), Option.none()]
      }),
      new SupportedDefaults({
        provider: "openrouter",
        defaults: new ModelSettings({ temperature: 0.3, maxTokens: 11, topP: 0.9, stop: ["END"], seed: 7 }),
        fields: ["temperature", "max_tokens", "top_p", "stop", "seed"],
        expected: [Option.some(0.3), Option.some(11), Option.some(0.9), Option.some(["END"]), Option.some(7)]
      })
    ], (testCase) =>
      Effect.gen(function*() {
        const { requests, client } = yield* capturedTransport
        const options = isolated(testCase.provider, testCase.defaults)
        const runtime = yield* TextProvider.resolve(options)
        yield* Effect.forEach(
          [runtime.languageModel, TextProvider.layerConfig(options)],
          (layer) => LanguageModel.generateText({ prompt: "hello" }).pipe(Effect.result, Effect.provide(layer))
        ).pipe(Effect.provideService(HttpClient.HttpClient, client))
        const bodies = yield* Effect.forEach(yield* Ref.get(requests), serializedBody)
        expect(Arr.map(bodies, (body) => [
          Option.fromNullishOr(body.model),
          ...Arr.map(testCase.fields, (field) => Option.fromNullishOr(body[field]))
        ])).toEqual(
          Arr.replicate([Option.some("test-model"), ...testCase.expected], 2)
        )
      })))
})
