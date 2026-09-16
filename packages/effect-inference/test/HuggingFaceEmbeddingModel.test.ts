import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import * as Headers from "@effect/platform/Headers"
import * as HttpBody from "@effect/platform/HttpBody"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientError from "@effect/platform/HttpClientError"
import type * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean,
  Chunk,
  Deferred,
  Effect,
  Equal,
  Exit,
  FastCheck,
  Fiber,
  Inspectable,
  Match,
  Number,
  Option,
  Redacted,
  Ref,
  Schema,
  String,
  TestClock
} from "effect"

import * as HuggingFaceEmbeddingModel from "@scenesystems/effect-inference/HuggingFaceEmbeddingModel"
import * as HuggingFaceEndpoint from "@scenesystems/effect-inference/HuggingFaceEndpoint"
import * as HuggingFaceRouted from "@scenesystems/effect-inference/HuggingFaceRouted"
import * as Route from "@scenesystems/effect-inference/Route"

const endpoint = new HuggingFaceEmbeddingModel.Options({
  model: "org/embedding-model",
  route: HuggingFaceEndpoint.route({
    baseUrl: "https://endpoint.example.test/embed?deployment=blue",
    authMethod: "hf-token"
  }),
  accessToken: Redacted.make("hf_test-token")
})

const routed = new HuggingFaceEmbeddingModel.Options({
  model: "org/embedding-model",
  route: HuggingFaceRouted.route({
    baseUrl: "https://router.huggingface.co/v1",
    authMethod: "hf-token"
  }),
  accessToken: Redacted.make("hf_test-token")
})

const hfInferenceMapping = { providerId: "org/embedding-model", status: "live", task: "sentence-similarity" }

const mapping = {
  inferenceProviderMapping: {
    together: { providerId: "provider/model-v2", status: "live", task: "feature-extraction" },
    "hf-inference": hfInferenceMapping
  }
}

const json = (request: HttpClientRequest.HttpClientRequest, body: unknown, status = 200) =>
  HttpServerResponse.json(body, { status }).pipe(
    Effect.mapError((cause) => new HttpClientError.RequestError({ request, reason: "Encode", cause })),
    Effect.map((response) => HttpClientResponse.fromWeb(request, HttpServerResponse.toWeb(response)))
  )

describe("HuggingFaceEmbeddingModel", () => {
  it.effect("embeds at the exact endpoint with bearer auth, scalar/batch bodies, and no discovery", () =>
    Effect.gen(function*() {
      const requests = yield* Ref.make(Chunk.empty<HttpClientRequest.HttpClientRequest>())
      const client = HttpClient.make((request) =>
        Ref.updateAndGet(requests, Chunk.append(request)).pipe(
          Effect.flatMap((seen) =>
            Match.value(Chunk.size(seen)).pipe(
              Match.when(1, () => json(request, Arr.make(0.25, Number.negate(0.5)))),
              Match.orElse(() => json(request, Arr.make(Arr.make(1, 2), Arr.make(Number.negate(3), 4))))
            )
          )
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        expect(yield* model.embed("one")).toEqual(Arr.make(0.25, Number.negate(0.5)))
        expect(yield* model.embedMany(Arr.make("two", "three"))).toEqual(
          Arr.make(Arr.make(1, 2), Arr.make(Number.negate(3), 4))
        )
        expect(yield* model.embedMany(Arr.empty())).toEqual(Arr.empty())
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(endpoint)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
      const seen = yield* Ref.get(requests)
      expect(Chunk.size(seen)).toBe(2)
      const first = yield* Chunk.get(seen, 0)
      const second = yield* Chunk.get(seen, 1)
      expect(first.url).toBe(endpoint.route.baseUrl)
      expect(first.method).toBe("POST")
      expect(Headers.get(first.headers, "authorization")).toEqual(Option.some("Bearer hf_test-token"))
      expect(first.body).toEqual(yield* HttpBody.json({ inputs: "one" }))
      expect(second.body).toEqual(yield* HttpBody.json({ inputs: Arr.make("two", "three") }))
    }))

  it.effect("discovers once, uses the first mapping and restores indexed vectors to input order", () =>
    Effect.gen(function*() {
      const requests = yield* Ref.make(Chunk.empty<HttpClientRequest.HttpClientRequest>())
      const client = HttpClient.make((request) =>
        Ref.update(requests, Chunk.append(request)).pipe(
          Effect.andThen(() =>
            Match.value(request.method).pipe(
              Match.when("GET", () => json(request, mapping)),
              Match.orElse(() =>
                json(request, {
                  data: Arr.make({ index: 1, embedding: Arr.make(Number.negate(3), 4) }, {
                    index: 0,
                    embedding: Arr.make(1, 2)
                  })
                })
              )
            )
          )
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        expect(yield* model.embedMany(Arr.make("one", "two"))).toEqual(
          Arr.make(Arr.make(1, 2), Arr.make(Number.negate(3), 4))
        )
        expect(yield* model.embedMany(Arr.make("one", "two"))).toEqual(
          Arr.make(Arr.make(1, 2), Arr.make(Number.negate(3), 4))
        )
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
      const seen = yield* Ref.get(requests)
      expect(Chunk.size(seen)).toBe(3)
      const discovery = yield* Chunk.get(seen, 0)
      const inference = yield* Chunk.get(seen, 1)
      expect(discovery.url).toBe("https://huggingface.co/api/models/org/embedding-model")
      expect(discovery.urlParams).toEqual(Arr.of(Arr.make("expand[]", "inferenceProviderMapping")))
      expect(Headers.get(discovery.headers, "authorization")).toEqual(Option.some("Bearer hf_test-token"))
      expect(inference.url).toBe("https://router.huggingface.co/together/v1/embeddings")
      expect(inference.body).toEqual(
        yield* HttpBody.json({ input: Arr.make("one", "two"), model: "provider/model-v2" })
      )
    }))

  it.effect("fails malformed shapes and incomplete or inconsistent batches instead of leaving requests unresolved", () =>
    Effect.forEach(
      Arr.make(
        Arr.empty(),
        Arr.make(1, 2),
        Arr.of(Arr.make(1, 2)),
        Arr.make(Arr.make(1, 2), Arr.make(3, 4), Arr.make(5, 6)),
        Arr.make(Arr.make(1, 2), Arr.of(3)),
        Arr.make(Arr.make(1, 2), Arr.empty()),
        Arr.make(Arr.of(Arr.make(1, 2)), Arr.of(Arr.make(3, 4))),
        Arr.make(Arr.make(1, 2), Arr.make("x", 4))
      ),
      (output) =>
        Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embedMany(Arr.make("one", "two")))
          expect(error._tag).toBe("MalformedOutput")
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(endpoint)),
          Effect.provideService(HttpClient.HttpClient, HttpClient.make((request) => json(request, output)))
        )
    ))

  it.effect("keeps HTTP status evidence while redacting credentials, without retrying permanent failures", () =>
    Effect.forEach(Arr.make(401, 403, 404, 422, 429, 500), (status) =>
      Effect.gen(function*() {
        const calls = yield* Ref.make(0)
        const client = HttpClient.make((request) =>
          Ref.update(calls, Number.increment).pipe(
            Effect.andThen(json(request, { error: "access denied" }, status))
          )
        )
        yield* Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embed("one"))
          expect(error._tag).toBe("HttpResponseError")
          expect(Inspectable.format(error)).not.toContain("hf_test-token")
          yield* Match.value(error).pipe(
            Match.tag("HttpResponseError", (error) =>
              Effect.sync(() => {
                expect(error.response.status).toBe(status)
                expect(error.body).toContain("access denied")
                expect(error.request.url).toBe(endpoint.route.baseUrl)
              })),
            Match.orElse(() => Effect.dieMessage("Expected an HTTP response failure"))
          )
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(endpoint)),
          Effect.provideService(HttpClient.HttpClient, client)
        )
        expect(yield* Ref.get(calls)).toBe(1)
      })))

  it.effect("preserves injected client failure reasons without retaining credential-bearing request causes", () =>
    Effect.forEach(Schema.Literal("Transport", "Encode").literals, (reason) =>
      Effect.gen(function*() {
        const client = HttpClient.make((request) => Effect.fail(new HttpClientError.RequestError({ request, reason })))
        yield* Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embed("one"))
          expect(error).toMatchObject({ _tag: "HttpRequestError", reason })
          expect(Inspectable.format(error)).not.toContain("hf_test-token")
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(endpoint)),
          Effect.provideService(HttpClient.HttpClient, client)
        )
      })))

  it.effect("bounds 503 inference retries with backoff and never changes provider", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)
      const started = yield* Deferred.make<void>()
      const urls = yield* Ref.make(Chunk.empty<string>())
      const client = HttpClient.make((request) =>
        Match.value(request.method).pipe(
          Match.when("GET", () => json(request, mapping)),
          Match.orElse(() =>
            Ref.update(attempts, Number.increment).pipe(
              Effect.andThen(Ref.update(urls, Chunk.append(request.url))),
              Effect.andThen(Deferred.done(started, Exit.void)),
              Effect.andThen(json(request, { error: "loading" }, 503))
            )
          )
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const fiber = yield* Effect.fork(model.embed("one"))
        yield* Deferred.await(started)
        yield* TestClock.adjust("99 millis")
        expect(yield* Ref.get(attempts)).toBe(1)
        yield* TestClock.adjust("1 millis")
        expect(yield* Ref.get(attempts)).toBe(2)
        yield* TestClock.adjust("199 millis")
        expect(yield* Ref.get(attempts)).toBe(2)
        yield* TestClock.adjust("1 millis")
        const error = yield* Effect.flip(Fiber.join(fiber))
        expect(error._tag).toBe("HttpResponseError")
        expect(yield* Ref.get(attempts)).toBe(3)
        expect(Chunk.toArray(yield* Ref.get(urls))).toEqual(
          Arr.replicate("https://router.huggingface.co/together/v1/embeddings", 3)
        )
        yield* TestClock.adjust("1 minute")
        expect(yield* Ref.get(attempts)).toBe(3)
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
    }))

  it.effect("retries discovery transient failures and proceeds only after successful discovery", () =>
    Effect.gen(function*() {
      const gets = yield* Ref.make(0)
      const posts = yield* Ref.make(0)
      const started = yield* Deferred.make<void>()
      const client = HttpClient.make((request) =>
        Match.value(request.method).pipe(
          Match.when("GET", () =>
            Ref.updateAndGet(gets, Number.increment).pipe(
              Effect.tap(() => Deferred.done(started, Exit.void)),
              Effect.flatMap((count) =>
                Match.value(count).pipe(
                  Match.when(1, () => json(request, { error: "unavailable" }, 503)),
                  Match.orElse(() => json(request, mapping))
                )
              )
            )),
          Match.orElse(() =>
            Ref.update(posts, Number.increment).pipe(
              Effect.andThen(json(request, { data: Arr.of({ embedding: Arr.make(2, Number.negate(5)) }) }))
            )
          )
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const fiber = yield* Effect.fork(model.embed("one"))
        yield* Deferred.await(started)
        yield* TestClock.adjust("99 millis")
        expect(yield* Ref.get(posts)).toBe(0)
        expect(yield* Ref.get(gets)).toBe(1)
        yield* TestClock.adjust("1 millis")
        expect(yield* Fiber.join(fiber)).toEqual(Arr.make(2, Number.negate(5)))
        expect(yield* Ref.get(gets)).toBe(2)
        expect(yield* Ref.get(posts)).toBe(1)
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
    }))

  it.effect("coalesces discovery, permits waiter cancellation, expires mappings, and isolates model layers", () =>
    Effect.gen(function*() {
      const gets = yield* Ref.make(0)
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const client = HttpClient.make((request) =>
        Match.value(request.method).pipe(
          Match.when("GET", () =>
            Ref.update(gets, Number.increment).pipe(
              Effect.andThen(Deferred.done(started, Exit.void)),
              Effect.andThen(Deferred.await(release)),
              Effect.andThen(json(request, mapping))
            )),
          Match.orElse(() => json(request, { data: Arr.of({ embedding: Arr.make(2, Number.negate(5)) }) }))
        )
      )
      const layer = HuggingFaceEmbeddingModel.layer(routed)
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const first = yield* Effect.fork(model.embed("one"))
        yield* Deferred.await(started)
        const second = yield* Effect.fork(model.embed("two"))
        const cancelled = yield* Effect.fork(model.embed("cancelled"))
        yield* TestClock.adjust("1 millis")
        expect(Exit.isInterrupted(yield* Fiber.interrupt(cancelled))).toBe(true)
        expect(yield* Ref.get(gets)).toBe(1)
        yield* Deferred.done(release, Exit.void)
        expect(yield* Fiber.join(first)).toEqual(Arr.make(2, Number.negate(5)))
        expect(yield* Fiber.join(second)).toEqual(Arr.make(2, Number.negate(5)))
        yield* TestClock.adjust("4 minutes")
        expect(yield* model.embed("three")).toEqual(Arr.make(2, Number.negate(5)))
        expect(yield* Ref.get(gets)).toBe(1)
        yield* TestClock.adjust("61 seconds")
        expect(yield* model.embed("four")).toEqual(Arr.make(2, Number.negate(5)))
        expect(yield* Ref.get(gets)).toBe(2)
      }).pipe(Effect.provide(layer), Effect.provideService(HttpClient.HttpClient, client))
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        expect(yield* model.embed("one")).toEqual(Arr.make(2, Number.negate(5)))
      }).pipe(Effect.provide(layer), Effect.provideService(HttpClient.HttpClient, client))
      expect(yield* Ref.get(gets)).toBe(3)
    }))

  it.effect("interrupts discovery and inference and allows subsequent requests after interruption", () =>
    Effect.forEach(Arr.make("GET", "POST"), (blockedMethod) =>
      Effect.gen(function*() {
        const started = yield* Deferred.make<void>()
        const interrupted = yield* Deferred.make<void>()
        const blocked = yield* Ref.make(true)
        const gets = yield* Ref.make(0)
        const client = HttpClient.make((request) =>
          Effect.gen(function*() {
            yield* Ref.update(gets, (count) =>
              Match.value(request.method).pipe(
                Match.when("GET", () => Number.increment(count)),
                Match.orElse(() => count)
              ))
            yield* Effect.when(
              Deferred.done(started, Exit.void).pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() => Deferred.done(interrupted, Exit.void))
              ),
              () => Equal.equals(request.method, blockedMethod)
            ).pipe(Effect.whenEffect(Ref.get(blocked)))
            return yield* Match.value(request.method).pipe(
              Match.when("GET", () => json(request, mapping)),
              Match.orElse(() => json(request, { data: Arr.of({ embedding: Arr.make(2, Number.negate(5)) }) }))
            )
          })
        )
        yield* Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const fiber = yield* Effect.fork(model.embed("one"))
          yield* Deferred.await(started)
          const exit = yield* Fiber.interrupt(fiber)
          expect(Exit.isInterrupted(exit)).toBe(true)
          yield* Deferred.await(interrupted)
          yield* Ref.set(blocked, false)
          expect(yield* model.embed("one")).toEqual(Arr.make(2, Number.negate(5)))
          expect(yield* Ref.get(gets)).toBe(
            Match.value(blockedMethod).pipe(
              Match.when("GET", () => 2),
              Match.orElse(() => 1)
            )
          )
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
          Effect.provideService(HttpClient.HttpClient, client)
        )
      })))

  it.effect.prop("indexed response permutation preserves every input's embedding", {
    values: FastCheck.uniqueArray(FastCheck.integer({ min: Number.negate(10000), max: 10000 }), {
      minLength: 2,
      maxLength: 12
    })
  }, ({ values }) =>
    Effect.gen(function*() {
      const model = yield* EmbeddingModel.EmbeddingModel
      const texts = yield* Effect.forEach(values, (value) =>
        Schema.encode(Schema.NumberFromString)(value).pipe(Effect.map((encoded) =>
          String.concat("text-", encoded)
        )))
      expect(yield* model.embedMany(texts)).toEqual(
        Arr.map(values, (value) => Arr.make(value, Number.increment(value)))
      )
    }).pipe(
      Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Match.value(request.method).pipe(
            Match.when("GET", () => json(request, mapping)),
            Match.orElse(() =>
              json(request, {
                data: Arr.reverse(
                  Arr.map(values, (value, index) => ({ index, embedding: Arr.make(value, Number.increment(value)) }))
                )
              })
            )
          )
        )
      )
    ))

  it.effect("rejects duplicate, missing, mixed, fractional and out-of-range provider indices", () =>
    Effect.forEach(
      Arr.make(
        Arr.make({ index: 0, embedding: Arr.of(1) }, { index: 0, embedding: Arr.of(2) }),
        Arr.of({ index: 0, embedding: Arr.of(1) }),
        Arr.make({ index: 0, embedding: Arr.of(1) }, { index: 2, embedding: Arr.of(2) }),
        Arr.make({ index: Number.negate(1), embedding: Arr.of(1) }, { index: 1, embedding: Arr.of(2) }),
        Arr.make({ index: 0.5, embedding: Arr.of(1) }, { index: 1, embedding: Arr.of(2) }),
        Arr.make({ embedding: Arr.of(1) }, { index: 1, embedding: Arr.of(2) })
      ),
      (data) =>
        Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embedMany(Arr.make("one", "two")))
          expect(error._tag).toBe("MalformedOutput")
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
          Effect.provideService(
            HttpClient.HttpClient,
            HttpClient.make((request) =>
              Match.value(request.method).pipe(
                Match.when("GET", () => json(request, mapping)),
                Match.orElse(() => json(request, { data }))
              )
            )
          )
        )
    ))

  it.effect("honors explicit selection and provider-specific URLs and bodies, including dedicated provider keys", () =>
    Effect.forEach(
      Arr.make(
        {
          provider: "hf-inference",
          routedUrl: "https://gateway.example.test/hf/hf-inference/models/mapped/model/pipeline/feature-extraction",
          directUrl: "https://router.huggingface.co/hf-inference/models/mapped/model/pipeline/feature-extraction"
        },
        {
          provider: "deepinfra",
          routedUrl: "https://gateway.example.test/hf/deepinfra/v1/openai/embeddings",
          directUrl: "https://api.deepinfra.com/v1/openai/embeddings"
        },
        {
          provider: "scaleway",
          routedUrl: "https://gateway.example.test/hf/scaleway/v1/embeddings",
          directUrl: "https://api.scaleway.ai/v1/embeddings"
        },
        {
          provider: "together",
          routedUrl: "https://gateway.example.test/hf/together/v1/embeddings",
          directUrl: "https://api.together.xyz/v1/embeddings"
        }
      ),
      (contract) =>
        Effect.forEach(
          Arr.make(
            Option.some(Redacted.make("provider-test-key")),
            Option.some(Redacted.make("hf_test-token")),
            Option.none<Redacted.Redacted>()
          ),
          (token) =>
            Effect.gen(function*() {
              const requests = yield* Ref.make(Chunk.empty<HttpClientRequest.HttpClientRequest>())
              const options = new HuggingFaceEmbeddingModel.Options({
                model: routed.model,
                route: HuggingFaceRouted.route({
                  baseUrl: "https://gateway.example.test/hf/v1/",
                  authMethod: "hf-token",
                  selectionPolicy: Route.explicitProvider(contract.provider)
                }),
                ...Option.match(token, { onNone: () => ({}), onSome: (accessToken) => ({ accessToken }) })
              })
              const client = HttpClient.make((request) =>
                Ref.update(requests, Chunk.append(request)).pipe(Effect.andThen(() =>
                  Match.value(request.method).pipe(
                    Match.when("GET", () =>
                      json(request, {
                        inferenceProviderMapping: Arr.make(
                          {
                            provider: "unsupported",
                            providerId: "do-not-select",
                            status: "live",
                            task: "feature-extraction"
                          },
                          {
                            provider: contract.provider,
                            providerId: "mapped/model",
                            status: "staging",
                            task: Match.value(contract.provider).pipe(
                              Match.when("hf-inference", () => "sentence-similarity"),
                              Match.orElse(() => "feature-extraction")
                            )
                          }
                        )
                      })),
                    Match.orElse(() =>
                      json(
                        request,
                        Match.value(contract.provider).pipe(
                          Match.when("hf-inference", () => Arr.make(Arr.make(1, Number.negate(2)), Arr.make(3, 4))),
                          Match.orElse(() => ({
                            data: Arr.make({ embedding: Arr.make(1, Number.negate(2)) }, { embedding: Arr.make(3, 4) })
                          }))
                        )
                      )
                    )
                  )
                ))
              )
              yield* Effect.gen(function*() {
                const model = yield* EmbeddingModel.EmbeddingModel
                expect(yield* model.embedMany(Arr.make("one", "two"))).toEqual(
                  Arr.make(Arr.make(1, Number.negate(2)), Arr.make(3, 4))
                )
              }).pipe(
                Effect.provide(HuggingFaceEmbeddingModel.layer(options)),
                Effect.provideService(HttpClient.HttpClient, client)
              )
              const seen = yield* Ref.get(requests)
              const discovery = yield* Chunk.get(seen, 0)
              const inference = yield* Chunk.get(seen, 1)
              const direct = Option.exists(token, (token) => Equal.equals(Redacted.value(token), "provider-test-key"))
              expect(inference.url).toBe(Boolean.match(direct, {
                onTrue: () => contract.directUrl,
                onFalse: () => contract.routedUrl
              }))
              expect(Headers.get(discovery.headers, "authorization")).toEqual(Option.filterMap(token, (token) =>
                Boolean.match(direct, {
                  onTrue: () => Option.none(),
                  onFalse: () => Option.some(String.concat("Bearer ", Redacted.value(token)))
                })))
              expect(Headers.get(inference.headers, "authorization")).toEqual(
                Option.map(token, (token) => String.concat("Bearer ", Redacted.value(token)))
              )
              expect(inference.body).toEqual(
                yield* HttpBody.json(
                  Match.value(contract.provider).pipe(
                    Match.when("hf-inference", () => ({ inputs: Arr.make("one", "two") })),
                    Match.orElse(() => ({ input: Arr.make("one", "two"), model: "mapped/model" }))
                  )
                )
              )
            })
        )
    ))

  it.effect("fails unsupported policies, providers, missing mappings and wrong tasks without inference fallback", () => {
    const Scenario = Schema.Struct({
      policy: Schema.optional(Route.SelectionPolicy),
      mapping: Schema.Unknown,
      tag: Schema.String
    })
    const scenarios = Arr.make(
      Scenario.make({ policy: "fastest", mapping, tag: "MalformedInput" }),
      Scenario.make({ policy: "cheapest", mapping, tag: "MalformedInput" }),
      Scenario.make({ policy: "preferred", mapping, tag: "MalformedInput" }),
      Scenario.make({ policy: Route.explicitProvider("deepinfra"), mapping, tag: "MalformedInput" }),
      Scenario.make({
        mapping: {
          inferenceProviderMapping: {
            unknown: { providerId: "unknown", status: "live", task: "feature-extraction" },
            ...mapping.inferenceProviderMapping
          }
        },
        tag: "MalformedInput"
      }),
      Scenario.make({
        mapping: {
          inferenceProviderMapping: {
            together: { providerId: "chat", status: "live", task: "conversational" },
            "hf-inference": hfInferenceMapping
          }
        },
        tag: "MalformedInput"
      }),
      Scenario.make({ mapping: { inferenceProviderMapping: Arr.empty() }, tag: "MalformedInput" }),
      Scenario.make({ mapping: {}, tag: "MalformedOutput" }),
      Scenario.make({
        mapping: { inferenceProviderMapping: { together: { task: "feature-extraction" } } },
        tag: "MalformedOutput"
      })
    )
    return Effect.forEach(scenarios, (scenario) =>
      Effect.gen(function*() {
        const requests = yield* Ref.make(Chunk.empty<string>())
        const client = HttpClient.make((request) =>
          Ref.update(requests, Chunk.append(request.method)).pipe(Effect.andThen(json(request, scenario.mapping)))
        )
        const options = new HuggingFaceEmbeddingModel.Options({
          ...routed,
          route: { ...routed.route, selectionPolicy: scenario.policy }
        })
        yield* Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embed("one"))
          expect(error._tag).toBe(scenario.tag)
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(options)),
          Effect.provideService(HttpClient.HttpClient, client)
        )
        expect(Chunk.toArray(yield* Ref.get(requests))).toEqual(Arr.of("GET"))
      }))
  })

  it.effect("does not cache discovery failures as success and accepts a subsequent valid mapping", () =>
    Effect.gen(function*() {
      const gets = yield* Ref.make(0)
      const client = HttpClient.make((request) =>
        Match.value(request.method).pipe(
          Match.when("GET", () =>
            Ref.updateAndGet(gets, Number.increment).pipe(Effect.flatMap((count) =>
              Match.value(count).pipe(
                Match.when(1, () =>
                  json(request, { error: "forbidden" }, 403)),
                Match.orElse(() => json(request, mapping))
              )
            ))),
          Match.orElse(() =>
            json(request, { data: Arr.of({ embedding: Arr.make(7, 8) }) })
          )
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const error = yield* Effect.flip(model.embed("one"))
        expect(error._tag).toBe("HttpResponseError")
        expect(error.method).toBe("discoverProviders")
        yield* TestClock.adjust("1 millis")
        expect(yield* model.embed("one")).toEqual(Arr.make(7, 8))
        expect(yield* Ref.get(gets)).toBe(2)
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
    }))

  it.effect("rejects malformed JSON, non-JSON content types and non-finite numbers through typed failures", () =>
    Effect.forEach(
      Arr.make(
        { body: "{broken", contentType: "application/json", tag: "HttpResponseError" },
        { body: "[1e400, 2]", contentType: "application/json", tag: "MalformedOutput" },
        { body: "[1, 2]", contentType: "text/plain", tag: "MalformedOutput" },
        { body: "[1, 2]", contentType: "application/jsonp", tag: "MalformedOutput" },
        { body: "[1, 2]", contentType: "application/json-seq", tag: "MalformedOutput" }
      ),
      (fixture) =>
        Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embed("one"))
          expect(error._tag).toBe(fixture.tag)
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(endpoint)),
          Effect.provideService(
            HttpClient.HttpClient,
            HttpClient.make((request) =>
              Effect.succeed(
                HttpClientResponse.fromWeb(
                  request,
                  HttpServerResponse.toWeb(HttpServerResponse.text(fixture.body, { contentType: fixture.contentType }))
                )
              )
            )
          )
        )
    ))

  it.effect("accepts the case-insensitive JSON media type with optional parameters", () =>
    Effect.forEach(
      Arr.make("Application/JSON", "application/json; charset=utf-8", "APPLICATION/JSON ; charset=UTF-8"),
      (contentType) =>
        Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          expect(yield* model.embed("one")).toEqual(Arr.make(1, Number.negate(2)))
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(endpoint)),
          Effect.provideService(
            HttpClient.HttpClient,
            HttpClient.make((request) =>
              Effect.succeed(HttpClientResponse.fromWeb(
                request,
                HttpServerResponse.toWeb(HttpServerResponse.text("[1,-2]", { contentType }))
              ))
            )
          )
        )
    ))

  it.effect("rejects URL model references instead of changing endpoint semantics or sending discovery", () =>
    Effect.forEach(
      Arr.make(endpoint, routed),
      (options) =>
        Effect.forEach(Arr.make("https://wrong.example/model", "/model"), (model) =>
          Effect.gen(function*() {
            const calls = yield* Ref.make(0)
            const client = HttpClient.make((request) =>
              Ref.update(calls, Number.increment).pipe(Effect.andThen(json(request, Arr.make(1, 2))))
            )
            yield* Effect.gen(function*() {
              const embedding = yield* EmbeddingModel.EmbeddingModel
              const error = yield* Effect.flip(embedding.embed("one"))
              expect(error._tag).toBe("MalformedInput")
            }).pipe(
              Effect.provide(
                HuggingFaceEmbeddingModel.layer(
                  new HuggingFaceEmbeddingModel.Options({ ...options, model })
                )
              ),
              Effect.provideService(HttpClient.HttpClient, client)
            )
            expect(yield* Ref.get(calls)).toBe(0)
          }))
    ))
})
