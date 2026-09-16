/**
 * Usage observation for the native Effect Anthropic client.
 *
 * @since 0.4.0
 * @module
 */
import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as Generated from "@effect/ai-anthropic/Generated"
import type * as AiError from "@effect/ai/AiError"
import * as AiResponse from "@effect/ai/Response"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

/**
 * Describes where an Anthropic usage report was received while retaining both
 * its canonical cumulative projection and its exact native provider shape.
 *
 * `MessageDelta.raw` remains a `MessageDeltaUsage`; it is never widened into a
 * complete `BetaUsage` by copying fields from `MessageStart`.
 *
 * @since 0.4.0
 * @category schemas
 */
export const Observation = Schema.Union(
  Schema.TaggedStruct("Response", {
    usage: Schema.typeSchema(AiResponse.Usage),
    raw: Schema.typeSchema(Generated.BetaUsage)
  }),
  Schema.TaggedStruct("MessageStart", {
    usage: Schema.typeSchema(AiResponse.Usage),
    raw: Schema.typeSchema(Generated.BetaUsage)
  }),
  Schema.TaggedStruct("MessageDelta", {
    usage: Schema.typeSchema(AiResponse.Usage),
    raw: Schema.typeSchema(AnthropicClient.MessageDeltaUsage)
  })
)

/**
 * A source-tagged Anthropic usage observation.
 *
 * @since 0.4.0
 * @category models
 */
export type Observation = typeof Observation.Type

/**
 * Constructs and exhaustively matches Anthropic usage observations by `_tag`.
 *
 * @since 0.4.0
 * @category models
 */
const observations = Data.taggedEnum<Observation>()

const projectUsage = (raw: Generated.BetaUsage): AiResponse.Usage =>
  new AiResponse.Usage({
    inputTokens: raw.input_tokens,
    outputTokens: raw.output_tokens,
    totalTokens: undefined,
    ...Option.match(Option.fromNullable(raw.cache_read_input_tokens), {
      onNone: () => ({}),
      onSome: (cachedInputTokens) => ({ cachedInputTokens })
    })
  })

const mergeUsage = (
  current: AiResponse.Usage,
  update: AnthropicClient.MessageDeltaUsage
): AiResponse.Usage =>
  new AiResponse.Usage({
    inputTokens: Option.fromNullable(update.input_tokens).pipe(
      Option.getOrElse(() => current.inputTokens)
    ),
    outputTokens: Option.fromNullable(update.output_tokens).pipe(
      Option.getOrElse(() => current.outputTokens)
    ),
    totalTokens: undefined,
    cachedInputTokens: Option.fromNullable(update.cache_read_input_tokens).pipe(
      Option.getOrElse(() => current.cachedInputTokens)
    )
  })

const observeStream = (
  stream: Stream.Stream<AnthropicClient.MessageStreamEvent, AiError.AiError>,
  observe: (observation: Observation) => Effect.Effect<void>
): Stream.Stream<AnthropicClient.MessageStreamEvent, AiError.AiError> =>
  Stream.unwrap(
    Ref.make(
      new AiResponse.Usage({
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined
      })
    ).pipe(
      Effect.map((state) =>
        stream.pipe(
          Stream.tap((event) =>
            Match.value(event).pipe(
              Match.when({ type: "message_start" }, (event) => {
                const usage = projectUsage(event.message.usage)
                return Ref.set(state, usage).pipe(
                  Effect.zipRight(observe(observations.MessageStart({
                    usage,
                    raw: event.message.usage
                  })))
                )
              }),
              Match.when({ type: "message_delta" }, (event) =>
                Ref.updateAndGet(
                  state,
                  (current) => mergeUsage(current, event.usage)
                ).pipe(
                  Effect.flatMap((usage) =>
                    observe(observations.MessageDelta({
                      usage,
                      raw: event.usage
                    }))
                  )
                )),
              Match.discriminator("type")(
                "ping",
                "error",
                "message_stop",
                "content_block_start",
                "content_block_delta",
                "content_block_stop",
                () => Effect.void
              ),
              Match.exhaustive
            )
          )
        )
      )
    )
  )

const decorateCreateMessage = (
  createMessage: AnthropicClient.Service["createMessage"],
  observe: (observation: Observation) => Effect.Effect<void>
): AnthropicClient.Service["createMessage"] =>
(options) =>
  createMessage(options).pipe(
    Effect.tap((message) =>
      observe(observations.Response({
        usage: projectUsage(message.usage),
        raw: message.usage
      }))
    )
  )

const decorateCreateMessageStream = (
  createMessageStream: AnthropicClient.Service["createMessageStream"],
  observe: (observation: Observation) => Effect.Effect<void>
): AnthropicClient.Service["createMessageStream"] =>
(options) => observeStream(createMessageStream(options), observe)

/**
 * Decorates a native Anthropic client so message usage is observed before the
 * native language model transforms the response. For streams, every received
 * `message_start` and `message_delta` produces a cumulative, possibly partial
 * observation. Delta counters replace prior counters instead of being added,
 * and `message_stop` does not produce a duplicate observation. If a stream
 * fails or is interrupted before terminal usage arrives, the latest received
 * observation is retained; usage which was never received cannot be invented.
 * Callbacks are usage observations, not billable-call notifications: consumers
 * associate the latest observation with the single language-model invocation.
 * Each observation is source-tagged and retains the exact native report. In
 * particular, a `MessageDelta` retains `MessageDeltaUsage`, including server tool
 * evidence, rather than fabricating a complete `BetaUsage` from prior values.
 *
 * Like the native Anthropic model, `inputTokens` retains `input_tokens` without
 * folding cache reads or cache creation into it. Cache reads remain independently
 * available as `cachedInputTokens`. No overall total or separate reasoning count
 * is reported by this protocol, so those fields remain absent. These observations
 * do not infer totals supplied by a later native model transformation.
 *
 * @example
 * ```ts
 * import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
 * import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
 * import { Effect } from "effect"
 * import { AnthropicUsage } from "@scenesystems/effect-inference"
 *
 * const model = Effect.gen(function*() {
 *   const client = yield* AnthropicClient.AnthropicClient
 *   const observed = AnthropicUsage.observe(client, (observation) => Effect.log(observation))
 *   return yield* AnthropicLanguageModel.make({ model: "claude-sonnet-4-5" }).pipe(
 *     Effect.provideService(AnthropicClient.AnthropicClient, observed)
 *   )
 * })
 * ```
 *
 * @since 0.4.0
 * @category combinators
 */
export const observe = (
  client: AnthropicClient.Service,
  observe: (observation: Observation) => Effect.Effect<void>
): AnthropicClient.Service =>
  Struct.evolve(client, {
    createMessage: (createMessage) => decorateCreateMessage(createMessage, observe),
    createMessageStream: (createMessageStream) => decorateCreateMessageStream(createMessageStream, observe)
  })
