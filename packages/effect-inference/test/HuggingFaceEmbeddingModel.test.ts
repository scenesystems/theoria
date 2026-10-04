import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean,
  Chunk,
  Deferred,
  Effect,
  Equal,
  Exit,
  Fiber,
  Inspectable,
  Match,
  Number,
  Option,
  Redacted,
  Ref,
  Schema,
  String
} from "effect"
import { EmbeddingModel } from "effect/ai"
import {
  Headers,
  HttpBody,
  HttpClient,
  HttpClientError,
  type HttpClientRequest,
  HttpClientResponse,
  HttpServerResponse
} from "effect/http"
import * as TestClock from "effect/testing/TestClock"

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
    Effect.mapError((cause) =>
      new HttpClientError.HttpClientError({ reason: new HttpClientError.EncodeError({ request, cause }) })
    ),
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
              Match.when(1, () => json(request, Arr.make(0.25, -(0.5)))),
              Match.orElse(() => json(request, Arr.make(Arr.make(1, 2), Arr.make(-3, 4))))
            )
          )
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const single = yield* model.embed("one")
        expect(single.vector).toEqual(Arr.make(0.25, -(0.5)))
        const batch = yield* model.embedMany(Arr.make("two", "three"))
        expect(Arr.map(batch.embeddings, (embedding) => embedding.vector)).toEqual(
          Arr.make(Arr.make(1, 2), Arr.make(-3, 4))
        )
        expect(batch.usage.inputTokens).toBeUndefined()
        const empty = yield* model.embedMany(Arr.empty())
        expect(empty.embeddings).toEqual(Arr.empty())
        expect(empty.usage.inputTokens).toBeUndefined()
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(endpoint)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
      const seen = yield* Ref.get(requests)
      expect(Chunk.size(seen)).toBe(2)
      const first = yield* Effect.fromOption(Chunk.get(seen, 0))
      const second = yield* Effect.fromOption(Chunk.get(seen, 1))
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
                  data: Arr.make({ index: 1, embedding: Arr.make(-3, 4) }, {
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
        const first = yield* model.embedMany(Arr.make("one", "two"))
        expect(Arr.map(first.embeddings, (embedding) => embedding.vector)).toEqual(
          Arr.make(Arr.make(1, 2), Arr.make(-3, 4))
        )
        expect(first.usage.inputTokens).toBeUndefined()
        const second = yield* model.embedMany(Arr.make("one", "two"))
        expect(Arr.map(second.embeddings, (embedding) => embedding.vector)).toEqual(
          Arr.make(Arr.make(1, 2), Arr.make(-3, 4))
        )
        expect(second.usage.inputTokens).toBeUndefined()
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
      const seen = yield* Ref.get(requests)
      expect(Chunk.size(seen)).toBe(3)
      const discovery = yield* Effect.fromOption(Chunk.get(seen, 0))
      const inference = yield* Effect.fromOption(Chunk.get(seen, 1))
      expect(discovery.url).toBe("https://huggingface.co/api/models/org/embedding-model")
      expect(discovery.urlParams.params).toEqual(Arr.of(Arr.make("expand[]", "inferenceProviderMapping")))
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
          expect(error.reason._tag).toBe("InvalidOutputError")
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
          expect(error._tag).toBe("AiError")
          expect(Inspectable.toStringUnknown(error)).not.toContain("hf_test-token")
          const http = yield* Match.value(error.reason).pipe(
            Match.tags({
              AuthenticationError: ({ http }) => Effect.fromOption(Option.fromNullishOr(http)),
              InternalProviderError: ({ http }) => Effect.fromOption(Option.fromNullishOr(http)),
              InvalidRequestError: ({ http }) => Effect.fromOption(Option.fromNullishOr(http)),
              RateLimitError: ({ http }) => Effect.fromOption(Option.fromNullishOr(http)),
              UnknownError: ({ http }) => Effect.fromOption(Option.fromNullishOr(http))
            }),
            Match.orElse(() => Effect.die("Expected HTTP context"))
          )
          const response = yield* Effect.fromOption(Option.fromNullishOr(http.response))
          expect(response.status).toBe(status)
          expect(http.body).toContain("access denied")
          expect(http.request.url).toBe(endpoint.route.baseUrl)
        }).pipe(
          Effect.provide(HuggingFaceEmbeddingModel.layer(endpoint)),
          Effect.provideService(HttpClient.HttpClient, client)
        )
        expect(yield* Ref.get(calls)).toBe(1)
      })))

  it.effect("preserves injected client failure reasons without retaining credential-bearing request causes", () =>
    Effect.forEach(Schema.Literals(["TransportError", "EncodeError"]).literals, (reason) =>
      Effect.gen(function*() {
        const client = HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: Match.value(reason).pipe(
                Match.when("TransportError", () => new HttpClientError.TransportError({ request })),
                Match.when("EncodeError", () => new HttpClientError.EncodeError({ request })),
                Match.exhaustive
              )
            })
          )
        )
        yield* Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embed("one"))
          expect(error.reason).toMatchObject({ _tag: "NetworkError", reason })
          expect(Inspectable.toStringUnknown(error)).not.toContain("hf_test-token")
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
        const fiber = yield* Effect.forkChild(model.embed("one"))
        yield* Deferred.await(started)
        yield* TestClock.adjust("99 millis")
        expect(yield* Ref.get(attempts)).toBe(1)
        yield* TestClock.adjust("1 millis")
        expect(yield* Ref.get(attempts)).toBe(2)
        yield* TestClock.adjust("199 millis")
        expect(yield* Ref.get(attempts)).toBe(2)
        yield* TestClock.adjust("1 millis")
        const error = yield* Effect.flip(Fiber.join(fiber))
        expect(error.reason._tag).toBe("InternalProviderError")
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
              Effect.andThen(json(request, { data: Arr.of({ embedding: Arr.make(2, -5) }) }))
            )
          )
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const fiber = yield* Effect.forkChild(model.embed("one"))
        yield* Deferred.await(started)
        yield* TestClock.adjust("99 millis")
        expect(yield* Ref.get(posts)).toBe(0)
        expect(yield* Ref.get(gets)).toBe(1)
        yield* TestClock.adjust("1 millis")
        expect((yield* Fiber.join(fiber)).vector).toEqual(Arr.make(2, -5))
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
      const interrupted = yield* Deferred.make<void>()
      const client = HttpClient.make((request) =>
        Match.value(request.method).pipe(
          Match.when("GET", () =>
            Ref.update(gets, Number.increment).pipe(
              Effect.andThen(Deferred.done(started, Exit.void)),
              Effect.andThen(Deferred.await(release)),
              Effect.andThen(json(request, mapping)),
              Effect.onInterrupt(() => Deferred.done(interrupted, Exit.void))
            )),
          Match.orElse(() => json(request, { data: Arr.of({ embedding: Arr.make(2, -5) }) }))
        )
      )
      const layer = HuggingFaceEmbeddingModel.layer(routed)
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const first = yield* Effect.forkChild(model.embed("one"))
        yield* Deferred.await(started)
        const second = yield* Effect.forkChild(model.embed("two"), { startImmediately: true })
        yield* TestClock.adjust("1 millis")
        yield* Fiber.interrupt(first)
        expect(yield* Deferred.isDone(interrupted)).toBe(false)
        expect(yield* Ref.get(gets)).toBe(1)
        yield* TestClock.adjust("10 minutes")
        yield* Deferred.done(release, Exit.void)
        expect((yield* Fiber.join(second)).vector).toEqual(Arr.make(2, -5))
        yield* TestClock.adjust("4 minutes")
        expect((yield* model.embed("three")).vector).toEqual(Arr.make(2, -5))
        expect(yield* Ref.get(gets)).toBe(1)
        yield* TestClock.adjust("61 seconds")
        const refreshed = yield* Effect.all(Arr.make(model.embed("four"), model.embed("five")), {
          concurrency: "unbounded"
        })
        expect(Arr.map(refreshed, (embedding) => embedding.vector)).toEqual(Arr.make(Arr.make(2, -5), Arr.make(2, -5)))
        expect(yield* Ref.get(gets)).toBe(2)
      }).pipe(Effect.provide(layer), Effect.provideService(HttpClient.HttpClient, client))
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        expect((yield* model.embed("one")).vector).toEqual(Arr.make(2, -5))
      }).pipe(Effect.provide(layer), Effect.provideService(HttpClient.HttpClient, client))
      expect(yield* Ref.get(gets)).toBe(3)
    }))

  it.effect.each(["GET", "POST"])(
    "interrupts %s and allows subsequent requests",
    (blockedMethod) =>
      Effect.forEach(Arr.make("embed", "embedMany"), (operation) =>
        Effect.gen(function*() {
          const started = yield* Deferred.make<void>()
          const finalized = yield* Deferred.make<void>()
          const blocked = yield* Ref.make(true)
          const gets = yield* Ref.make(0)
          const client = HttpClient.make((request) =>
            Effect.gen(function*() {
              yield* Ref.update(gets, (count) =>
                Match.value(request.method).pipe(
                  Match.when("GET", () => Number.increment(count)),
                  Match.orElse(() => count)
                ))
              const isBlocked = yield* Ref.get(blocked)
              yield* Effect.when(
                Deferred.done(started, Exit.void).pipe(
                  Effect.andThen(Effect.never),
                  Effect.onInterrupt(() => Deferred.done(finalized, Exit.void))
                ),
                Effect.succeed(Boolean.and(isBlocked, Equal.equals(request.method, blockedMethod)))
              )
              return yield* Match.value(request.method).pipe(
                Match.when("GET", () => json(request, mapping)),
                Match.orElse(() => json(request, { data: Arr.of({ embedding: Arr.make(2, -5) }) }))
              )
            })
          )
          yield* Effect.gen(function*() {
            const model = yield* EmbeddingModel.EmbeddingModel
            const fiber = yield* Effect.forkChild(
              Match.value(operation).pipe(
                Match.when("embed", () => Effect.asVoid(model.embed("one"))),
                Match.orElse(() => Effect.asVoid(model.embedMany(Arr.of("one"))))
              )
            )
            yield* Deferred.await(started)
            yield* Fiber.interrupt(fiber)
            expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true)
            expect(yield* Deferred.isDone(finalized)).toBe(true)
            yield* Ref.set(blocked, false)
            expect((yield* model.embed("one")).vector).toEqual(Arr.make(2, -5))
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
        }))
  )

  it.effect("evicts failed discovery after the initiating waiter leaves without advancing time", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const gets = yield* Ref.make(0)
      const client = HttpClient.make((request) =>
        Match.value(request.method).pipe(
          Match.when("GET", () =>
            Ref.updateAndGet(gets, Number.increment).pipe(
              Effect.flatMap((count) =>
                Match.value(count).pipe(
                  Match.when(1, () =>
                    Deferred.done(started, Exit.void).pipe(
                      Effect.andThen(Deferred.await(release)),
                      Effect.andThen(json(request, { error: "unauthorized" }, 401))
                    )),
                  Match.orElse(() => json(request, mapping))
                )
              )
            )),
          Match.orElse(() => json(request, { data: Arr.of({ embedding: Arr.make(2, -5) }) }))
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const first = yield* Effect.forkChild(model.embed("one"))
        yield* Deferred.await(started)
        const second = yield* Effect.forkChild(Effect.flip(model.embed("two")), { startImmediately: true })
        yield* Fiber.interrupt(first)
        yield* Deferred.done(release, Exit.void)
        expect((yield* Fiber.join(second)).reason._tag).toBe("AuthenticationError")
        expect(yield* Ref.get(gets)).toBe(1)
        expect((yield* model.embed("retry")).vector).toEqual(Arr.make(2, -5))
        expect(yield* Ref.get(gets)).toBe(2)
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
    }))

  it.effect("interrupts shared discovery only after its final caller leaves", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const interrupted = yield* Deferred.make<void>()
      const posts = yield* Ref.make(0)
      const client = HttpClient.make((request) =>
        Match.value(request.method).pipe(
          Match.when("GET", () =>
            Deferred.done(started, Exit.void).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() => Deferred.done(interrupted, Exit.void))
            )),
          Match.orElse(() => Ref.update(posts, Number.increment).pipe(Effect.andThen(json(request, Arr.of(1)))))
        )
      )
      yield* Effect.gen(function*() {
        const model = yield* EmbeddingModel.EmbeddingModel
        const first = yield* Effect.forkChild(model.embed("one"))
        yield* Deferred.await(started)
        const second = yield* Effect.forkChild(model.embed("two"), { startImmediately: true })
        yield* TestClock.adjust("1 millis")
        yield* Fiber.interrupt(first)
        expect(yield* Deferred.isDone(interrupted)).toBe(false)
        yield* Fiber.interrupt(second)
        expect(yield* Deferred.isDone(interrupted)).toBe(true)
        expect(yield* Ref.get(posts)).toBe(0)
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
    }))

  it.effect.prop("indexed response permutation preserves every input's embedding", {
    values: Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: -10000, maximum: 10000 }))).check(
      Schema.isMinLength(2),
      Schema.isMaxLength(12),
      Schema.isUnique()
    )
  }, ({ values }) =>
    Effect.gen(function*() {
      const model = yield* EmbeddingModel.EmbeddingModel
      const texts = yield* Effect.forEach(values, (value) =>
        Schema.encodeEffect(Schema.FiniteFromString)(value).pipe(Effect.map((encoded) =>
          String.concat("text-", encoded)
        )))
      const response = yield* model.embedMany(texts)
      expect(Arr.map(response.embeddings, (embedding) =>
        embedding.vector)).toEqual(
          Arr.map(values, (value) =>
            Arr.make(value, Number.increment(value)))
        )
      expect(response.usage.inputTokens).toBeUndefined()
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
        Arr.make({ index: -1, embedding: Arr.of(1) }, { index: 1, embedding: Arr.of(2) }),
        Arr.make({ index: 0.5, embedding: Arr.of(1) }, { index: 1, embedding: Arr.of(2) }),
        Arr.make({ embedding: Arr.of(1) }, { index: 1, embedding: Arr.of(2) })
      ),
      (data) =>
        Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embedMany(Arr.make("one", "two")))
          expect(error.reason._tag).toBe("InvalidOutputError")
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
                          Match.when("hf-inference", () => Arr.make(Arr.make(1, -2), Arr.make(3, 4))),
                          Match.orElse(() => ({
                            data: Arr.make({ embedding: Arr.make(1, -2) }, { embedding: Arr.make(3, 4) })
                          }))
                        )
                      )
                    )
                  )
                ))
              )
              yield* Effect.gen(function*() {
                const model = yield* EmbeddingModel.EmbeddingModel
                const response = yield* model.embedMany(Arr.make("one", "two"))
                expect(Arr.map(response.embeddings, (embedding) => embedding.vector)).toEqual(
                  Arr.make(Arr.make(1, -2), Arr.make(3, 4))
                )
                expect(response.usage.inputTokens).toBeUndefined()
              }).pipe(
                Effect.provide(HuggingFaceEmbeddingModel.layer(options)),
                Effect.provideService(HttpClient.HttpClient, client)
              )
              const seen = yield* Ref.get(requests)
              const discovery = yield* Effect.fromOption(Chunk.get(seen, 0))
              const inference = yield* Effect.fromOption(Chunk.get(seen, 1))
              const direct = Option.exists(token, (token) => Equal.equals(Redacted.value(token), "provider-test-key"))
              expect(inference.url).toBe(Boolean.match(direct, {
                onTrue: () => contract.directUrl,
                onFalse: () => contract.routedUrl
              }))
              const discoveryAuthorization = Option.map(
                Option.filter(token, () => Boolean.not(direct)),
                (token) => String.concat("Bearer ", Redacted.value(token))
              )
              expect(Headers.get(discovery.headers, "authorization")).toEqual(discoveryAuthorization)
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
      Scenario.make({ policy: "fastest", mapping, tag: "InvalidRequestError" }),
      Scenario.make({ policy: "cheapest", mapping, tag: "InvalidRequestError" }),
      Scenario.make({ policy: "preferred", mapping, tag: "InvalidRequestError" }),
      Scenario.make({ policy: Route.explicitProvider("deepinfra"), mapping, tag: "InvalidRequestError" }),
      Scenario.make({
        mapping: {
          inferenceProviderMapping: {
            unknown: { providerId: "unknown", status: "live", task: "feature-extraction" },
            ...mapping.inferenceProviderMapping
          }
        },
        tag: "InvalidRequestError"
      }),
      Scenario.make({
        mapping: {
          inferenceProviderMapping: {
            together: { providerId: "chat", status: "live", task: "conversational" },
            "hf-inference": hfInferenceMapping
          }
        },
        tag: "InvalidRequestError"
      }),
      Scenario.make({ mapping: { inferenceProviderMapping: Arr.empty() }, tag: "InvalidRequestError" }),
      Scenario.make({ mapping: {}, tag: "InvalidOutputError" }),
      Scenario.make({
        mapping: { inferenceProviderMapping: { together: { task: "feature-extraction" } } },
        tag: "InvalidOutputError"
      })
    )
    return Effect.forEach(scenarios, (scenario) =>
      Effect.gen(function*() {
        const requests = yield* Ref.make(Chunk.empty<string>())
        const client = HttpClient.make((request) =>
          Ref.update(requests, Chunk.append(request.method)).pipe(Effect.andThen(json(request, scenario.mapping)))
        )
        const options = new HuggingFaceEmbeddingModel.Options({
          model: routed.model,
          ...Option.match(Option.fromNullishOr(routed.accessToken), {
            onNone: () => ({}),
            onSome: (accessToken) => ({ accessToken })
          }),
          route: { ...routed.route, selectionPolicy: scenario.policy }
        })
        yield* Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embed("one"))
          expect(error.reason._tag).toBe(scenario.tag)
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
        expect(error.reason._tag).toBe("AuthenticationError")
        expect(error.method).toBe("discoverProviders")
        yield* TestClock.adjust("1 millis")
        expect((yield* model.embed("one")).vector).toEqual(Arr.make(7, 8))
        expect(yield* Ref.get(gets)).toBe(2)
      }).pipe(
        Effect.provide(HuggingFaceEmbeddingModel.layer(routed)),
        Effect.provideService(HttpClient.HttpClient, client)
      )
    }))

  it.effect("rejects malformed JSON, non-JSON content types and non-finite numbers through typed failures", () =>
    Effect.forEach(
      Arr.make(
        { body: "{broken", contentType: "application/json", tag: "InvalidOutputError" },
        { body: "[1e400, 2]", contentType: "application/json", tag: "InvalidOutputError" },
        { body: "[1, 2]", contentType: "text/plain", tag: "InvalidOutputError" },
        { body: "[1, 2]", contentType: "application/jsonp", tag: "InvalidOutputError" },
        { body: "[1, 2]", contentType: "application/json-seq", tag: "InvalidOutputError" }
      ),
      (fixture) =>
        Effect.gen(function*() {
          const model = yield* EmbeddingModel.EmbeddingModel
          const error = yield* Effect.flip(model.embed("one"))
          expect(error.reason._tag).toBe(fixture.tag)
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
          expect((yield* model.embed("one")).vector).toEqual(Arr.make(1, -2))
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
              expect(error.reason._tag).toBe("InvalidRequestError")
            }).pipe(
              Effect.provide(
                HuggingFaceEmbeddingModel.layer(
                  new HuggingFaceEmbeddingModel.Options({
                    model,
                    route: options.route,
                    ...Option.match(Option.fromNullishOr(options.accessToken), {
                      onNone: () => ({}),
                      onSome: (accessToken) => ({ accessToken })
                    })
                  })
                )
              ),
              Effect.provideService(HttpClient.HttpClient, client)
            )
            expect(yield* Ref.get(calls)).toBe(0)
          }))
    ))
})
