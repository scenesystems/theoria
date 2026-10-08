import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
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

const config = (provider: TextProvider.Provider, model: string, defaults: ModelSettings) =>
  new TextProvider.Config({
    provider,
    model,
    defaults,
    apiKey: Redacted.make("test"),
    apiUrl: Option.none(),
    anthropicVersion: Option.none(),
    openrouterReferrer: Option.none(),
    openrouterTitle: Option.none()
  })

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
        const runtime = (temperature: number) =>
          new TextProvider.Runtime({
            config: config(provider, "same", new ModelSettings({ temperature }))
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
            ),
            Effect.provideService(HttpClient.HttpClient, client)
          )
        yield* LanguageModel.generateText({ prompt: "unbound" }).pipe(
          Effect.result,
          Effect.provide(runtime(0.2).languageModel),
          Effect.provideService(HttpClient.HttpClient, client)
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
          body.temperature)).toEqual([0.2, 0.2, 0.7, 0.5, 0.4])
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
            config: config(provider, model, new ModelSettings({ temperature: 0.91, maxTokens: 900, topP: 0.8 }))
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
          )).pipe(
            Effect.provide(Layer.merge(ModelBinder.layer(runtimes), Testing.languageModel())),
            Effect.provideService(HttpClient.HttpClient, client)
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
              Effect.die("expected serialized request body")
            )
          ))
        expect(Arr.map(bodies, (body) => body.model)).toEqual(["teacher-model", "task-model"])
        expect(Arr.map(bodies, (body) => body.temperature)).toEqual([0, 0])
        expect(Arr.map(bodies, (body) => body.top_p)).toEqual([0.8, 0.8])
        expect(Arr.map(bodies, (body) =>
          Option.fromNullishOr(body.max_output_tokens).pipe(Option.getOrElse(() =>
            body.max_tokens
          )))).toEqual([73, 73])
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
          config: config(provider, "test", new ModelSettings({}))
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
                  settings: Match.value(source).pipe(
                    Match.when("request", () => settings),
                    Match.orElse(() => new ModelSettings({}))
                  ),
                  rolloutId: Option.none()
                })
              ),
              Effect.flip,
              Effect.tap((error) =>
                Effect.sync(() =>
                  expect(error).toMatchObject({
                    module: "@scenesystems/effect-inference/ModelBinder",
                    reason: {
                      _tag: "InvalidRequestError",
                      parameter: Match.value(provider).pipe(
                        Match.when("openai", () => "stop"),
                        Match.orElse(() => "seed")
                      )
                    }
                  })
                )
              )
            )).pipe(
              Effect.provide(
                Layer.merge(
                  ModelBinder.layer(
                    HashMap.fromIterable<Role, TextProvider.Runtime>([[
                      "task",
                      new TextProvider.Runtime({
                        config: new TextProvider.Config(Struct.assign(runtime.config, {
                          defaults: Match.value(source).pipe(
                            Match.when("defaults", () => settings),
                            Match.orElse(() => new ModelSettings({}))
                          )
                        }))
                      })
                    ]])
                  ),
                  Testing.languageModel()
                )
              ),
              Effect.provideService(HttpClient.HttpClient, client)
            ))
        expect(yield* Ref.get(requests)).toBe(0)
      })))
})
