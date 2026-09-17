/**
 * Usage observation for the native Effect Google client.
 *
 * @since 0.4.0
 * @module
 */
import * as Generated from "@effect/ai-google/Generated"
import type * as GoogleClient from "@effect/ai-google/GoogleClient"
import * as AiResponse from "@effect/ai/Response"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

/**
 * Canonical usage paired with the exact Google usage report.
 *
 * @since 0.5.0
 * @category models
 */
export const Observation = Schema.transform(
  Schema.typeSchema(Generated.UsageMetadata),
  Schema.Struct({
    usage: Schema.typeSchema(AiResponse.Usage),
    raw: Schema.typeSchema(Generated.UsageMetadata)
  }),
  {
    strict: true,
    decode: (raw) => ({
      usage: new AiResponse.Usage({
        inputTokens: raw.promptTokenCount,
        outputTokens: raw.candidatesTokenCount,
        totalTokens: raw.totalTokenCount,
        reasoningTokens: raw.thoughtsTokenCount,
        cachedInputTokens: raw.cachedContentTokenCount
      }),
      raw
    }),
    encode: (_encoded, observation) => observation.raw
  }
)

/** Canonical and raw Google usage observation inferred from its schema. @since 0.5.0 @category models */
export type Observation = typeof Observation.Type

const decodeObservation = Schema.decodeSync(Observation)

const observeOptional = (
  metadata: Option.Option<Generated.UsageMetadata>,
  observe: (
    usage: AiResponse.Usage,
    raw: Option.Option<Generated.UsageMetadata>
  ) => Effect.Effect<void>
): Effect.Effect<void> =>
  metadata.pipe(
    Option.match({
      onNone: () =>
        observe(
          new AiResponse.Usage({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined }),
          Option.none()
        ),
      onSome: (raw) => observe(decodeObservation(raw).usage, Option.some(raw))
    })
  )

const decorateGenerateContent = (
  generateContent: GoogleClient.Service["generateContent"],
  observe: (
    usage: AiResponse.Usage,
    raw: Option.Option<Generated.UsageMetadata>
  ) => Effect.Effect<void>
): GoogleClient.Service["generateContent"] =>
(request) =>
  generateContent(request).pipe(
    Effect.tap((response) => observeOptional(Option.fromNullable(response.usageMetadata), observe))
  )

const decorateGenerateContentStream = (
  generateContentStream: GoogleClient.Service["generateContentStream"],
  observe: (
    usage: AiResponse.Usage,
    raw: Option.Option<Generated.UsageMetadata>
  ) => Effect.Effect<void>
): GoogleClient.Service["generateContentStream"] =>
(request) =>
  generateContentStream(request).pipe(
    Stream.tap((response) =>
      Option.match(Option.fromNullable(response.usageMetadata), {
        onNone: () => Effect.void,
        onSome: (raw) => observe(decodeObservation(raw).usage, Option.some(raw))
      })
    )
  )

/**
 * Decorates a native Google client so every received usage metadata snapshot
 * is observed before the native language model decodes candidates or tools.
 * The callback receives canonical usage and the original decoded Google
 * metadata in an Option. Non-streaming responses without metadata emit unknown
 * canonical counters and None; stream events without metadata do not overwrite
 * earlier snapshots. Responses, stream events, failures, interruption, and client
 * resource lifetimes are otherwise unchanged.
 *
 * Google prompt usage already includes cached content, so cache usage remains
 * an independent `cachedInputTokens` counter and is not added to `inputTokens`.
 * Missing counters remain absent, explicit zeros remain zero, and totals are
 * never inferred. Streaming snapshots are cumulative observations: consumers
 * should retain the latest snapshot for one invocation rather than sum them.
 *
 * The projection schema retains the complete native metadata alongside the
 * canonical usage, making its reverse transformation return that retained raw
 * value instead of inventing provider fields.
 *
 * @example
 * ```ts
 * import * as GoogleClient from "@effect/ai-google/GoogleClient"
 * import * as GoogleLanguageModel from "@effect/ai-google/GoogleLanguageModel"
 * import { Data, Effect } from "effect"
 * import { GoogleUsage } from "@scenesystems/effect-inference"
 *
 * const model = Effect.gen(function*() {
 *   const client = yield* GoogleClient.GoogleClient
 *   const observed = GoogleUsage.observe(
 *     client,
 *     (usage, raw) => Effect.log(Data.struct({ usage, raw }))
 *   )
 *   return yield* GoogleLanguageModel.make({ model: "gemini-2.5-flash" }).pipe(
 *     Effect.provideService(GoogleClient.GoogleClient, observed)
 *   )
 * })
 * ```
 *
 * @since 0.4.0
 * @category combinators
 */
export const observe = (
  client: GoogleClient.Service,
  observe: (
    usage: AiResponse.Usage,
    raw: Option.Option<Generated.UsageMetadata>
  ) => Effect.Effect<void>
): GoogleClient.Service =>
  Struct.evolve(client, {
    generateContent: (generateContent) => decorateGenerateContent(generateContent, observe),
    generateContentStream: (generateContentStream) => decorateGenerateContentStream(generateContentStream, observe)
  })
