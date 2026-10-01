/**
 * Native Hugging Face feature-extraction transport and provider discovery.
 *
 * @since 0.1.0
 */
import * as AiError from "@effect/ai/AiError"
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import * as Headers from "@effect/platform/Headers"
import * as HttpClient from "@effect/platform/HttpClient"
import type * as HttpClientError from "@effect/platform/HttpClientError"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import {
  Array as Arr,
  Boolean,
  Cache,
  Duration,
  Effect,
  Equal,
  Exit,
  Layer,
  Match,
  Number,
  Option,
  pipe,
  Record,
  Redacted,
  Schedule,
  Schema,
  String
} from "effect"

import type { Options } from "../HuggingFaceEmbeddingModel.js"
import type { SelectionPolicy } from "../Route.js"

const moduleName = "HuggingFace"
const Vector = Schema.mutable(Schema.NonEmptyArray(Schema.Number.pipe(Schema.finite())))
const Batch = Schema.NonEmptyArray(Vector)
const FeatureOutput = Schema.Union(Vector, Batch)
const ProviderOutput = Schema.Struct({
  data: Schema.NonEmptyArray(Schema.Struct({
    embedding: Vector,
    index: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))
  }))
})
const Inputs = Schema.Union(Schema.String, Schema.NonEmptyArray(Schema.String))
const Payload = Schema.Union(
  Schema.Struct({ inputs: Inputs }),
  Schema.Struct({ input: Inputs, model: Schema.String })
)
const ModelRef = Schema.String.pipe(Schema.pattern(/^(?!https?:|\/)/))
const Provider = Schema.Literal("hf-inference", "deepinfra", "scaleway", "together")
const MappingDetails = Schema.Struct({
  providerId: Schema.NonEmptyString,
  status: Schema.Literal("live", "staging"),
  task: Schema.String
})
const Mapping = Schema.Struct({ ...MappingDetails.fields, provider: Schema.String })
const MappingArray = Schema.Array(Mapping)
const Discovery = Schema.Struct({
  inferenceProviderMapping: Schema.Union(
    MappingArray,
    Schema.Record({ key: Schema.String, value: MappingDetails })
  )
})
class Target extends Schema.Class<Target>("@scenesystems/effect-inference/internal/huggingFaceEmbeddingModel/Target")({
  url: Schema.String,
  model: Schema.String,
  format: Schema.Literal("hf", "openai")
}) {}

const malformedInput = (description: string) =>
  new AiError.MalformedInput({ module: moduleName, method: "featureExtraction", description })

const malformedOutput = (description: string) =>
  new AiError.MalformedOutput({ module: moduleName, method: "featureExtraction", description })

const decodeOutput = <A, I>(schema: Schema.Schema<A, I>, output: unknown) =>
  Schema.decodeUnknown(schema)(output).pipe(
    Effect.mapError((error) =>
      AiError.MalformedOutput.fromParseError({ module: moduleName, method: "featureExtraction", error })
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
              Arr.every(data, (item) => Option.isSome(Option.fromNullable(item.index))),
              Arr.every(data, (item) => Option.isNone(Option.fromNullable(item.index)))
            ),
          () => malformedOutput("Provider returned a mixture of indexed and unindexed embeddings.")
        ),
        Effect.map(({ data }) =>
          Arr.map(data, (item, index) => ({
            index: Option.getOrElse(Option.fromNullable(item.index), () => index),
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
          Arr.every(results, (result) => Number.lessThan(result.index, count)),
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
    const names = yield* Headers.currentRedactedNames
    const redact = (headers: Headers.Headers) =>
      Record.map(Headers.redact(headers, names), (value) =>
        Match.value(value).pipe(
          Match.when(Redacted.isRedacted, () => "[REDACTED]"),
          Match.orElse((value) => value)
        ))
    const request = AiError.HttpRequestDetails.make({
      method: error.request.method,
      url: error.request.url,
      urlParams: error.request.urlParams,
      hash: error.request.hash,
      headers: redact(error.request.headers)
    })
    return yield* Match.value(error).pipe(
      Match.tag("RequestError", (error) =>
        Effect.fail(
          new AiError.HttpRequestError({
            module: moduleName,
            method,
            request,
            reason: error.reason
          })
        )),
      Match.tag("ResponseError", (error) =>
        Effect.gen(function*() {
          const body = yield* error.response.text.pipe(Effect.match({
            onFailure: () => Option.none<string>(),
            onSuccess: Option.some
          }))
          return yield* new AiError.HttpResponseError({
            module: moduleName,
            method,
            request,
            reason: error.reason,
            response: { status: error.response.status, headers: redact(error.response.headers) },
            ...Option.match(body, { onNone: () => ({}), onSome: (body) => ({ body }) })
          })
        })),
      Match.exhaustive
    )
  })

// Scope each attempt, including body consumption, before retrying. Only 503
// retains the SDK's retry classification, now with a finite native schedule.
const requestJson = <A, I>(
  client: HttpClient.HttpClient,
  request: HttpClientRequest.HttpClientRequest,
  schema: Schema.Schema<A, I>,
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
        () =>
          new AiError.MalformedOutput({
            module: moduleName,
            method,
            description: "Expected an application/json response."
          })
      ),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
      Effect.catchTags({
        RequestError: (error) => httpError(error, method),
        ResponseError: (error) => httpError(error, method),
        ParseError: (error) =>
          Effect.fail(AiError.MalformedOutput.fromParseError({ module: moduleName, method, error }))
      })
    )
  ).pipe(
    Effect.retry({
      schedule: Schedule.exponential("100 millis").pipe(Schedule.intersect(Schedule.recurs(2))),
      while: (error) =>
        Match.value(error).pipe(
          Match.tag(
            "HttpResponseError",
            (error) => Boolean.and(Equal.equals(error.reason, "StatusCode"), Equal.equals(error.response.status, 503))
          ),
          Match.orElse(() => false)
        )
    })
  )

const selectProvider = (mappings: typeof MappingArray.Type, policy: Option.Option<SelectionPolicy>) =>
  Match.value(Option.getOrElse(policy, (): SelectionPolicy => "auto")).pipe(
    Match.when("auto", () =>
      Arr.head(mappings).pipe(
        Effect.mapError(() => malformedInput("No inference provider is available for this model."))
      )),
    Match.when(
      { _tag: "provider" },
      ({ provider }) =>
        Arr.findFirst(mappings, (mapping) => Equal.equals(mapping.provider, provider)).pipe(
          Effect.mapError(() => malformedInput("The requested provider has no mapping for this model."))
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
      Schema.decodeUnknown(Provider)(mapping.provider).pipe(
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
      const token = Option.fromNullable(options.accessToken).pipe(
        Option.filter((token) => String.isNonEmpty(Redacted.value(token)))
      )
      const hfToken = Option.filter(token, (token) => String.startsWith("hf_")(Redacted.value(token)))
      const discovery = yield* Cache.makeWith({
        capacity: 1,
        timeToLive: Exit.match({ onFailure: () => Duration.zero, onSuccess: () => Duration.minutes(5) }),
        lookup: (model: string) =>
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
          ).pipe(Effect.map(({ inferenceProviderMapping }) =>
            Match.value(inferenceProviderMapping).pipe(
              Match.when(Schema.is(MappingArray), (mappings) => mappings),
              Match.orElse((mappings) => Record.collect(mappings, (provider, mapping) => ({ ...mapping, provider })))
            )
          ))
      })
      const target = Match.value(options.route.serveMode).pipe(
        Match.when("routed-marketplace", () =>
          discovery.get(options.model).pipe(
            Effect.flatMap((mappings) => selectProvider(mappings, Option.fromNullable(options.route.selectionPolicy))),
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
      return yield* EmbeddingModel.make({
        embedMany: (input) =>
          Arr.match(input, {
            onEmpty: () =>
              Effect.succeed(Arr.empty<EmbeddingModel.Result>()),
            onNonEmpty: (input) =>
              Effect.gen(function*() {
                yield* Schema.decodeUnknown(ModelRef)(options.model).pipe(
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
                  Effect.mapError((cause) =>
                    new AiError.MalformedInput({ module: moduleName, method: "featureExtraction", cause })
                  )
                )
                const output = yield* requestJson(client, request, Schema.Unknown, "featureExtraction")
                return yield* normalizeEmbeddings(output, Arr.length(input), resolved.format)
              })
          })
      })
    })
  )
