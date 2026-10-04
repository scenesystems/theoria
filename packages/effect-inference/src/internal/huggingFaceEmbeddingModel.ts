/**
 * Native Hugging Face feature-extraction transport and provider discovery.
 *
 * @since 0.1.0
 */
import {
  Array as Arr,
  Boolean,
  Clock,
  Duration,
  Effect,
  Equal,
  Equivalence,
  Layer,
  Match,
  Number,
  Option,
  pipe,
  Record,
  Redacted,
  Schedule,
  Schema,
  ScopedCache,
  String
} from "effect"
import { AiError, EmbeddingModel } from "effect/ai"
import { Headers, HttpClient, type HttpClientError, HttpClientRequest, HttpClientResponse } from "effect/http"

import type { Options } from "../HuggingFaceEmbeddingModel.js"
import type { SelectionPolicy } from "../Route.js"

const moduleName = "HuggingFace"
const Vector = Schema.NonEmptyArray(Schema.Finite).pipe(Schema.mutable)
const Batch = Schema.NonEmptyArray(Vector)
const FeatureOutput = Schema.Union([Vector, Batch])
const ProviderOutput = Schema.Struct({
  data: Schema.NonEmptyArray(Schema.Struct({
    embedding: Vector,
    index: Schema.optional(Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))))
  }))
})
const Inputs = Schema.Union([Schema.String, Schema.NonEmptyArray(Schema.String)])
const Payload = Schema.Union([
  Schema.Struct({ inputs: Inputs }),
  Schema.Struct({ input: Inputs, model: Schema.String })
])
const ModelRef = Schema.String.pipe(Schema.check(Schema.isPattern(/^(?!https?:|\/)/)))
const Provider = Schema.Literals(["hf-inference", "deepinfra", "scaleway", "together"])
const MappingDetails = Schema.Struct({
  providerId: Schema.NonEmptyString,
  status: Schema.Literals(["live", "staging"]),
  task: Schema.String
})
const Mapping = Schema.Struct({ ...MappingDetails.fields, provider: Schema.String })
const MappingArray = Schema.Array(Mapping)
const Discovery = Schema.Struct({
  inferenceProviderMapping: Schema.Union([
    MappingArray,
    Schema.Record(Schema.String, MappingDetails)
  ])
})
class DiscoveryEntry extends Schema.Class<DiscoveryEntry>(
  "@scenesystems/effect-inference/internal/huggingFaceEmbeddingModel/DiscoveryEntry"
)({
  mappings: MappingArray,
  expiresAt: Schema.Finite
}) {}
class Target extends Schema.Class<Target>("@scenesystems/effect-inference/internal/huggingFaceEmbeddingModel/Target")({
  url: Schema.String,
  model: Schema.String,
  format: Schema.Literals(["hf", "openai"])
}) {}

const malformedInput = (description: string) =>
  AiError.make({
    module: moduleName,
    method: "featureExtraction",
    reason: new AiError.InvalidRequestError({ description })
  })

const malformedOutput = (description: string) =>
  AiError.make({
    module: moduleName,
    method: "featureExtraction",
    reason: new AiError.InvalidOutputError({ description })
  })

const decodeOutput = <A, I>(schema: Schema.Codec<A, I>, output: unknown) =>
  Schema.decodeUnknownEffect(schema)(output).pipe(
    Effect.mapError((error) =>
      AiError.make({
        module: moduleName,
        method: "featureExtraction",
        reason: AiError.InvalidOutputError.fromSchemaError(error)
      })
    )
  )

// Validate before handing results to EmbeddingModel's request resolver: a
// missing or duplicated index would otherwise leave a request uncompleted.
const normalizeEmbeddings = (output: unknown, count: number, format: Target["format"]) =>
  Match.value(format).pipe(
    Match.when("hf", () =>
      decodeOutput(FeatureOutput, output).pipe(
        Effect.map((decoded) =>
          Match.value(decoded).pipe(
            Match.when(Schema.is(Vector), (embeddings) => Arr.of({ index: 0, embeddings })),
            Match.orElse((batch) => Arr.map(batch, (embeddings, index) => ({ index, embeddings })))
          )
        )
      )),
    Match.when("openai", () =>
      decodeOutput(ProviderOutput, output).pipe(
        Effect.filterOrFail(
          ({ data }) =>
            Boolean.or(
              Arr.every(data, (item) => Option.isSome(Option.fromNullishOr(item.index))),
              Arr.every(data, (item) => Option.isNone(Option.fromNullishOr(item.index)))
            ),
          () => malformedOutput("Provider returned a mixture of indexed and unindexed embeddings.")
        ),
        Effect.map(({ data }) =>
          Arr.map(data, (item, index) => ({
            index: Option.getOrElse(Option.fromNullishOr(item.index), () => index),
            embeddings: item.embedding
          }))
        )
      )),
    Match.exhaustive,
    Effect.filterOrFail(
      (results) =>
        Boolean.every(Arr.make(
          Equal.equals(Arr.length(results), count),
          Equal.equals(Arr.length(Arr.dedupe(Arr.map(results, (result) => result.index))), count),
          Arr.every(results, (result) => Number.isLessThan(result.index, count)),
          Arr.every(
            results,
            (result) => Equal.equals(Arr.length(result.embeddings), Arr.length(Arr.headNonEmpty(results).embeddings))
          )
        )),
      () => malformedOutput("Expected one nonempty, equal-width embedding per input with a complete index permutation.")
    )
  )

const authenticate = (request: HttpClientRequest.HttpClientRequest, token: Option.Option<Redacted.Redacted>) =>
  Option.match(token, {
    onNone: () => request,
    onSome: (token) => HttpClientRequest.bearerToken(request, token)
  })

// Do not retain platform request/response objects as causes: their headers
// contain live credentials, even outside an Effect logging redaction context.
const httpError = (error: HttpClientError.HttpClientError, method: string) =>
  Effect.gen(function*() {
    const names = yield* Headers.CurrentRedactedNames
    const redact = (headers: Headers.Headers) =>
      Record.map(Headers.redact(headers, names), (value) =>
        Match.value(value).pipe(
          Match.when(Redacted.isRedacted, () => "[REDACTED]"),
          Match.orElse((value) => value)
        ))
    const request = AiError.HttpRequestDetails.make({
      method: error.request.method,
      url: error.request.url,
      urlParams: Arr.fromIterable(error.request.urlParams),
      ...Option.match(error.request.hash, { onNone: () => ({}), onSome: (hash) => ({ hash }) }),
      headers: redact(error.request.headers)
    })
    return yield* Match.value(error.reason).pipe(
      Match.tagsExhaustive({
        TransportError: (reason) =>
          Effect.fail(AiError.make({
            module: moduleName,
            method,
            reason: new AiError.NetworkError({
              reason: "TransportError",
              request,
              ...Option.match(Option.fromNullishOr(reason.description), {
                onNone: () => ({}),
                onSome: (description) => ({ description })
              })
            })
          })),
        EncodeError: (reason) =>
          Effect.fail(AiError.make({
            module: moduleName,
            method,
            reason: new AiError.NetworkError({ reason: "EncodeError", request, description: reason.description })
          })),
        InvalidUrlError: (reason) =>
          Effect.fail(AiError.make({
            module: moduleName,
            method,
            reason: new AiError.NetworkError({ reason: "InvalidUrlError", request, description: reason.description })
          })),
        StatusCodeError: (reason) =>
          Effect.gen(function*() {
            const body = yield* reason.response.text.pipe(Effect.match({
              onFailure: () => Option.none<string>(),
              onSuccess: Option.some
            }))
            return yield* AiError.make({
              module: moduleName,
              method,
              reason: AiError.reasonFromHttpStatus({
                status: reason.response.status,
                http: {
                  request,
                  response: { status: reason.response.status, headers: redact(reason.response.headers) },
                  ...Option.match(body, { onNone: () => ({}), onSome: (body) => ({ body }) })
                }
              })
            })
          }),
        DecodeError: (reason) =>
          Effect.fail(AiError.make({
            module: moduleName,
            method,
            reason: new AiError.InvalidOutputError({
              description: Option.getOrElse(
                Option.fromNullishOr(reason.description),
                () => "Failed to decode the JSON response."
              )
            })
          })),
        EmptyBodyError: () => Effect.fail(malformedOutput("Expected a JSON response body."))
      })
    )
  })

// Scope each attempt, including body consumption, before retrying. Only 503
// retains the SDK's retry classification, now with a finite native schedule.
const requestJson = <A, I>(
  client: HttpClient.HttpClient,
  request: HttpClientRequest.HttpClientRequest,
  schema: Schema.Codec<A, I>,
  method: string
) =>
  Effect.scoped(
    client.execute(request).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.filterOrFail(
        (response) =>
          Option.exists(Headers.get(response.headers, "content-type"), (contentType) =>
            pipe(
              contentType,
              String.split(";"),
              Arr.headNonEmpty,
              String.trim,
              String.toLowerCase,
              Equal.equals("application/json")
            )),
        () => malformedOutput("Expected an application/json response.")
      ),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
      Effect.catchTags({
        HttpClientError: (error) => httpError(error, method),
        SchemaError: (error) =>
          Effect.fail(
            AiError.make({ module: moduleName, method, reason: AiError.InvalidOutputError.fromSchemaError(error) })
          )
      })
    )
  ).pipe(
    Effect.retry({
      schedule: Schedule.exponential("100 millis"),
      times: 2,
      while: (error) =>
        Match.value(error.reason).pipe(
          Match.tag("InternalProviderError", (reason) =>
            Option.exists(Option.fromNullishOr(reason.http), (http) =>
              Option.exists(Option.fromNullishOr(http.response), (response) => Equal.equals(response.status, 503)))),
          Match.orElse(() =>
            false
          )
        )
    })
  )

const selectProvider = (mappings: typeof MappingArray.Type, policy: Option.Option<SelectionPolicy>) =>
  Match.value(Option.getOrElse(policy, (): SelectionPolicy => "auto")).pipe(
    Match.when("auto", () =>
      Effect.fromOption(
        Arr.head(mappings),
        () => malformedInput("No inference provider is available for this model.")
      )),
    Match.when(
      { _tag: "provider" },
      ({ provider }) =>
        Effect.fromOption(
          Arr.findFirst(mappings, (mapping) => Equal.equals(mapping.provider, provider)),
          () => malformedInput("The requested provider has no mapping for this model.")
        )
    ),
    Match.whenOr(
      "fastest",
      "cheapest",
      "preferred",
      () =>
        Effect.fail(
          malformedInput("Feature extraction does not support chat-only fastest, cheapest or preferred policies.")
        )
    ),
    Match.exhaustive,
    Effect.flatMap((mapping) =>
      Schema.decodeUnknownEffect(Provider)(mapping.provider).pipe(
        Effect.mapError(() => malformedInput("The selected provider does not support feature extraction.")),
        Effect.filterOrFail(
          (provider) =>
            Boolean.or(
              Equal.equals(mapping.task, "feature-extraction"),
              Boolean.and(Equal.equals(provider, "hf-inference"), Equal.equals(mapping.task, "sentence-similarity"))
            ),
          () => malformedInput("The selected provider mapping does not support feature extraction for this model.")
        ),
        Effect.map((provider) => ({ ...mapping, provider }))
      )
    )
  )

const providerTarget = (
  mapping: typeof Mapping.Type,
  provider: typeof Provider.Type,
  options: Options,
  direct: boolean
) => {
  const baseUrl = Boolean.match(direct, {
    onFalse: () => Arr.join(Arr.make(String.replace(/\/(?:v1\/?)?$/, "")(options.route.baseUrl), provider), "/"),
    onTrue: () =>
      Match.value(provider).pipe(
        Match.when("hf-inference", () => "https://router.huggingface.co/hf-inference"),
        Match.when("deepinfra", () => "https://api.deepinfra.com"),
        Match.when("scaleway", () => "https://api.scaleway.ai"),
        Match.when("together", () => "https://api.together.xyz"),
        Match.exhaustive
      )
  })
  return Match.value(provider).pipe(
    Match.when(
      "hf-inference",
      () =>
        new Target({
          url: Arr.join(Arr.make(baseUrl, "models", mapping.providerId, "pipeline/feature-extraction"), "/"),
          model: mapping.providerId,
          format: "hf"
        })
    ),
    Match.when(
      "deepinfra",
      () =>
        new Target({
          url: String.concat(baseUrl, "/v1/openai/embeddings"),
          model: mapping.providerId,
          format: "openai"
        })
    ),
    Match.whenOr(
      "scaleway",
      "together",
      () => new Target({ url: String.concat(baseUrl, "/v1/embeddings"), model: mapping.providerId, format: "openai" })
    ),
    Match.exhaustive
  )
}

/** @internal */
export const layer = (
  options: Options
): Layer.Layer<EmbeddingModel.EmbeddingModel, never, HttpClient.HttpClient> =>
  Layer.effect(
    EmbeddingModel.EmbeddingModel,
    Effect.gen(function*() {
      const client = yield* HttpClient.HttpClient
      const token = Option.fromNullishOr(options.accessToken).pipe(
        Option.filter((token) => String.isNonEmpty(Redacted.value(token)))
      )
      const hfToken = Option.filter(token, (token) => String.startsWith("hf_")(Redacted.value(token)))
      const clock = yield* Clock.Clock
      const discovery: ScopedCache.ScopedCache<string, DiscoveryEntry, AiError.AiError> = yield* ScopedCache.make({
        // Let the cache register its lookup fiber before transport callbacks
        // can synchronously start another waiter or cancel the initiating one.
        lookup: (model: string) =>
          Effect.andThen(Effect.yieldNow, () =>
            requestJson(
              client,
              authenticate(
                HttpClientRequest.get(String.concat("https://huggingface.co/api/models/", model)).pipe(
                  HttpClientRequest.setUrlParam("expand[]", "inferenceProviderMapping")
                ),
                hfToken
              ),
              Discovery,
              "discoverProviders"
            ).pipe(
              Effect.flatMap(({ inferenceProviderMapping }) =>
                Effect.map(clock.currentTimeMillis, (completedAt) =>
                  new DiscoveryEntry({
                    mappings: Match.value(inferenceProviderMapping).pipe(
                      Match.when(Schema.is(MappingArray), (mappings) => mappings),
                      Match.orElse((mappings) =>
                        Record.collect(mappings, (provider, mapping) => ({ ...mapping, provider }))
                      )
                    ),
                    expiresAt: Number.sum(completedAt, Duration.toMillis(Duration.minutes(5)))
                  }))
              )
            )).pipe(
              // Evict in the producer, before publishing failure to its waiters.
              Effect.onError(() => ScopedCache.invalidate(discovery, model))
            ),
        // Native TTL reads the initiating fiber's clock after it may have
        // terminated. Keep the deadline in the value using the layer's clock.
        capacity: 1
      })
      const getMappings: Effect.Effect<typeof MappingArray.Type, AiError.AiError> = Effect.gen(function*() {
        const entry = yield* ScopedCache.get(discovery, options.model)
        const now = yield* clock.currentTimeMillis
        return yield* Boolean.match(Number.isLessThan(now, entry.expiresAt), {
          onTrue: () => Effect.succeed(entry.mappings),
          onFalse: () =>
            ScopedCache.invalidateWhen(
              discovery,
              options.model,
              (current) => Equivalence.strictEqual<DiscoveryEntry>()(current, entry)
            ).pipe(Effect.andThen(() => getMappings))
        })
      })
      const target = Match.value(options.route.serveMode).pipe(
        Match.when("routed-marketplace", () =>
          getMappings.pipe(
            Effect.flatMap((mappings) => selectProvider(mappings, Option.fromNullishOr(options.route.selectionPolicy))),
            Effect.map((mapping) =>
              providerTarget(
                mapping,
                mapping.provider,
                options,
                Boolean.and(Option.isSome(token), Option.isNone(hfToken))
              )
            )
          )),
        Match.whenOr("hosted-api", "dedicated-endpoint", "self-hosted", "local-runtime", () =>
          Effect.succeed(new Target({ url: options.route.baseUrl, model: options.model, format: "hf" }))),
        Match.exhaustive
      )
      const model = yield* EmbeddingModel.make({
        embedMany: ({ inputs: input }) =>
          Arr.match(input, {
            onEmpty: () =>
              Effect.succeed({ results: [], usage: { inputTokens: undefined } }),
            onNonEmpty: (input) =>
              Effect.gen(function*() {
                yield* Schema.decodeEffect(ModelRef)(options.model).pipe(
                  Effect.mapError(() =>
                    malformedInput("Model URLs are not supported. Supply the endpoint URL in route.baseUrl.")
                  )
                )
                const resolved = yield* target
                const [first, rest] = Arr.unprepend(input)
                const inputs = Arr.match(rest, {
                  onEmpty: () =>
                    first,
                  onNonEmpty: () =>
                    input
                })
                const payload = Match.value(resolved.format).pipe(
                  Match.when("hf", () => ({ inputs })),
                  Match.when("openai", () => ({ input: inputs, model: resolved.model })),
                  Match.exhaustive
                )
                const request = yield* HttpClientRequest.schemaBodyJson(Payload)(
                  authenticate(HttpClientRequest.post(resolved.url), token),
                  payload
                ).pipe(
                  Effect.mapError(() =>
                    malformedInput("Failed to encode the feature extraction request.")
                  )
                )
                const output = yield* requestJson(client, request, Schema.Unknown, "featureExtraction")
                const normalized = yield* normalizeEmbeddings(output, Arr.length(input), resolved.format)
                return {
                  results: Arr.map(Arr.sortWith(normalized, (result) => result.index, Number.Order), (result) =>
                    result.embeddings),
                  usage: { inputTokens: undefined }
                }
              })
          })
      })
      // Keep inference owned by its caller. Effect 4.0.0's request runtime
      // does not interrupt an executing resolver batch when its caller leaves.
      // Discovery still coalesces, and embedMany remains explicitly batched.
      return EmbeddingModel.EmbeddingModel.of({
        ...model,
        embed: (input) =>
          model.embedMany(Arr.of(input)).pipe(
            Effect.flatMap(({ embeddings }) =>
              Effect.fromOption(
                Arr.head(embeddings),
                () =>
                  malformedOutput("Expected one embedding for a single input.")
              )
            ),
            Effect.withSpan("EmbeddingModel.embed")
          )
      })
    })
  )
