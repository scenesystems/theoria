import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as Binding from "@scenesystems/effect-lm/ModelBinder"
import * as ModelIdentity from "@scenesystems/effect-lm/ModelIdentity"
import { Current as CurrentSettings, ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import type { Role } from "@scenesystems/effect-lm/Role"
import {
  Array as Arr,
  Effect,
  HashMap,
  Layer,
  Match,
  Option,
  Redacted,
  Ref,
  Schema,
  Stream,
  String,
  Struct
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { HttpClient, type HttpClientRequest, HttpClientResponse, HttpServerResponse } from "effect/http"
import * as ModelBinder from "../src/ModelBinder.js"
import * as Testing from "../src/Testing.js"
import * as TextProvider from "../src/TextProvider.js"

describe("ModelBinder", () => {
  it.effect("binds declared defaults, ambient overrides and request settings in wire precedence order", () =>
    Effect.forEach(TextProvider.Provider.literals, (provider) =>
      Effect.gen(function*() {
        const requests = yield* Ref.make(Arr.empty<HttpClientRequest.HttpClientRequest>())
        const observed = yield* Ref.make(Arr.empty<ModelSettings>())
        const client = HttpClient.make((request) =>
          Ref.update(requests, Arr.append(request)).pipe(Effect.as(
            HttpClientResponse.fromWeb(
              request,
              HttpServerResponse.toWeb(HttpServerResponse.text("test", { status: 400 }))
            )
          ))
        )
        const languageModel = Match.value(provider).pipe(
          Match.when("openai", () =>
            OpenAiLanguageModel.layer({ model: "same", config: { temperature: 0.91 } }).pipe(
              Layer.provide(OpenAiClient.layer({ apiKey: Redacted.make("test") }))
            )),
          Match.when("anthropic", () =>
            AnthropicLanguageModel.layer({ model: "same", config: { temperature: 0.91 } }).pipe(
              Layer.provide(AnthropicClient.layer({ apiKey: Redacted.make("test") }))
            )),
          Match.when("openrouter", () =>
            OpenRouterLanguageModel.layer({ model: "same", config: { temperature: 0.91 } }).pipe(
              Layer.provide(OpenRouterClient.layer({ apiKey: Redacted.make("test") }))
            )),
          Match.exhaustive,
          Layer.provide(Layer.succeed(HttpClient.HttpClient, client))
        )
        const runtime = (temperature: number) =>
          new TextProvider.Runtime({
            provider,
            model: "same",
            defaults: new ModelSettings({ temperature }),
            request: { model: { modelRef: "same" } },
            languageModel
          })
        const run = (temperature: number, settings: ModelSettings) =>
          Effect.gen(function*() {
            yield* Ref.update(observed, Arr.append(yield* CurrentSettings))
            expect(yield* ModelIdentity.Current).toEqual(
              Option.some(new ModelIdentity.Identity({ provider, model: "same" }))
            )
            return yield* LanguageModel.generateText({ prompt: "q" })
          }).pipe(
            Binding.bind(new Binding.Request({ role: "task", settings, rolloutId: Option.none() })),
            Effect.result,
            Effect.provide(
              Layer.merge(
                ModelBinder.layer(HashMap.fromIterable<Role, TextProvider.Runtime>([["task", runtime(temperature)]])),
                Testing.languageModel()
              )
            )
          )
        yield* run(0.2, new ModelSettings({}))
        yield* run(0.2, new ModelSettings({ temperature: 0.7 }))
        yield* run(0.5, new ModelSettings({}))
        yield* Match.value(provider).pipe(
          Match.when("openai", () =>
            run(0.2, new ModelSettings({})).pipe(OpenAiLanguageModel.withConfigOverride({ temperature: 0.4 }))),
          Match.when("anthropic", () =>
            run(0.2, new ModelSettings({})).pipe(AnthropicLanguageModel.withConfigOverride({ temperature: 0.4 }))),
          Match.when("openrouter", () =>
            run(0.2, new ModelSettings({})).pipe(OpenRouterLanguageModel.withConfigOverride({ temperature: 0.4 }))),
          Match.exhaustive
        )
        const bodies = yield* Effect.forEach(yield* Ref.get(requests), (request) =>
          Match.value(request.body).pipe(
            Match.tag("Uint8Array", (body) =>
              Stream.fromIterable([body.body]).pipe(
                Stream.decodeText,
                Stream.runFold(() =>
                  "", String.concat),
                Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))))
              )),
            Match.orElse(() =>
              Effect.die("expected serialized body")
            )
          ))
        expect(Arr.map(bodies, (body) =>
          body.temperature)).toEqual([0.2, 0.7, 0.5, 0.4])
        expect(Arr.map(yield* Ref.get(observed), (settings) =>
          settings.temperature)).toEqual([0.2, 0.7, 0.5, 0.4])
      })))

  it.effect("serializes overrides ahead of defaults and selects teacher runtime with task fallback", () =>
    Effect.forEach(TextProvider.Provider.literals, (provider) =>
      Effect.gen(function*() {
        const requests = yield* Ref.make(Arr.empty<HttpClientRequest.HttpClientRequest>())
        const client = HttpClient.make((request) =>
          Ref.update(requests, Arr.append(request)).pipe(Effect.as(
            HttpClientResponse.fromWeb(
              request,
              HttpServerResponse.toWeb(HttpServerResponse.text("test", { status: 400 }))
            )
          ))
        )
        const runtime = (model: string) =>
          new TextProvider.Runtime({
            provider,
            model,
            defaults: new ModelSettings({ temperature: 0.91, maxTokens: 900, topP: 0.8 }),
            request: { model: { modelRef: model } },
            languageModel: Match.value(provider).pipe(
              Match.when("openai", () =>
                OpenAiLanguageModel.layer({
                  model,
                  config: { temperature: 0.91, max_output_tokens: 900, top_p: 0.8 }
                }).pipe(Layer.provide(OpenAiClient.layer({ apiKey: Redacted.make("test") })))),
              Match.when("anthropic", () =>
                AnthropicLanguageModel.layer({
                  model,
                  config: { temperature: 0.91, max_tokens: 900, top_p: 0.8 }
                }).pipe(Layer.provide(AnthropicClient.layer({ apiKey: Redacted.make("test") })))),
              Match.when("openrouter", () =>
                OpenRouterLanguageModel.layer({
                  model,
                  config: { temperature: 0.91, max_tokens: 900, top_p: 0.8 }
                }).pipe(Layer.provide(OpenRouterClient.layer({ apiKey: Redacted.make("test") })))),
              Match.exhaustive,
              Layer.provide(Layer.succeed(HttpClient.HttpClient, client))
            )
          })
        const runtimes = HashMap.fromIterable<Role, TextProvider.Runtime>([
          ["task", runtime("task-model")],
          ["teacher", runtime("teacher-model")]
        ])
        yield* Effect.forEach(Schema.Literals(["teacher", "critic"]).literals, (role) =>
          LanguageModel.generateText({ prompt: "hello" }).pipe(
            Binding.bind(
              new Binding.Request({
                role,
                settings: new ModelSettings({ temperature: 0, maxTokens: 73 }),
                rolloutId: Option.some(9)
              })
            ),
            Effect.result
          )).pipe(Effect.provide(Layer.merge(ModelBinder.layer(runtimes), Testing.languageModel())))
        const bodies = yield* Effect.forEach(yield* Ref.get(requests), (request) =>
          Match.value(request.body).pipe(
            Match.tag("Uint8Array", (body) =>
              Stream.fromIterable([body.body]).pipe(
                Stream.decodeText,
                Stream.runFold(() =>
                  "", String.concat),
                Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))))
              )),
            Match.orElse(() =>
              Effect.die("expected serialized request body")
            )
          ))
        expect(Arr.map(bodies, (body) => body.model)).toEqual(["teacher-model", "task-model"])
        expect(Arr.map(bodies, (body) => body.temperature)).toEqual([0, 0])
        expect(Arr.map(bodies, (body) => body.top_p)).toEqual([0.8, 0.8])
        expect(Arr.map(bodies, (body) => body.max_output_tokens ?? body.max_tokens)).toEqual([73, 73])
      })))

  it.effect("rejects unsupported OpenAI stop and Anthropic seed before transport for every operation", () =>
    Effect.forEach(Schema.Literals(["openai", "anthropic"]).literals, (provider) =>
      Effect.gen(function*() {
        const requests = yield* Ref.make(0)
        const client = HttpClient.make((request) =>
          Ref.update(requests, (count) => count + 1).pipe(
            Effect.as(HttpClientResponse.fromWeb(request, HttpServerResponse.toWeb(HttpServerResponse.empty())))
          )
        )
        const runtime = new TextProvider.Runtime({
          provider,
          model: "test",
          defaults: new ModelSettings({}),
          request: { model: { modelRef: "test" } },
          languageModel: Match.value(provider).pipe(
            Match.when("openai", () =>
              OpenAiLanguageModel.layer({ model: "test" }).pipe(
                Layer.provide(OpenAiClient.layer({ apiKey: Redacted.make("test") }))
              )),
            Match.when("anthropic", () =>
              AnthropicLanguageModel.layer({ model: "test" }).pipe(
                Layer.provide(AnthropicClient.layer({ apiKey: Redacted.make("test") }))
              )),
            Match.exhaustive,
            Layer.provide(Layer.succeed(HttpClient.HttpClient, client))
          )
        })
        const settings = Match.value(provider).pipe(
          Match.when("openai", () => new ModelSettings({ stop: [] })),
          Match.when("anthropic", () => new ModelSettings({ seed: 0 })),
          Match.exhaustive
        )
        yield* Effect.forEach(Schema.Literals(["request", "defaults"]).literals, (source) =>
          Effect.forEach([
            LanguageModel.generateText({ prompt: "hello" }).pipe(Effect.asVoid),
            LanguageModel.generateObject({ prompt: "hello", schema: Schema.Struct({ answer: Schema.String }) }).pipe(
              Effect.asVoid
            ),
            LanguageModel.streamText({ prompt: "hello" }).pipe(Stream.runDrain)
          ], (operation) =>
            operation.pipe(
              Binding.bind(
                new Binding.Request({
                  role: "task",
                  settings: source === "request" ? settings : new ModelSettings({}),
                  rolloutId: Option.none()
                })
              ),
              Effect.flip,
              Effect.tap((error) =>
                Effect.sync(() =>
                  expect(error).toMatchObject({
                    module: "@scenesystems/effect-inference/ModelBinder",
                    reason: { _tag: "InvalidRequestError", parameter: provider === "openai" ? "stop" : "seed" }
                  })
                )
              )
            )).pipe(
              Effect.provide(
                Layer.merge(
                  ModelBinder.layer(
                    HashMap.fromIterable<Role, TextProvider.Runtime>([[
                      "task",
                      new TextProvider.Runtime(
                        Struct.assign(runtime, { defaults: source === "defaults" ? settings : new ModelSettings({}) })
                      )
                    ]])
                  ),
                  Testing.languageModel()
                )
              )
            ))
        expect(yield* Ref.get(requests)).toBe(0)
      })))
})
