/**
 * Usage observation for native Effect AI language-model constructors.
 *
 * @since 0.4.0
 * @module
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

type PartEncoded = Response.PartEncoded | Response.StreamPartEncoded

const observePart = (
  observe: (usage: Response.Usage, finish: Response.FinishPartEncoded) => Effect.Effect<void>
) =>
  Match.type<PartEncoded>().pipe(
    Match.when({ type: "finish" }, (finish) =>
      observe(
        new Response.Usage(finish.usage),
        finish
      )),
    Match.discriminator("type")(
      "text",
      "text-start",
      "text-delta",
      "text-end",
      "reasoning",
      "reasoning-start",
      "reasoning-delta",
      "reasoning-end",
      "tool-params-start",
      "tool-params-delta",
      "tool-params-end",
      "tool-call",
      "tool-result",
      "file",
      "source",
      "response-metadata",
      "error",
      () => Effect.void
    ),
    Match.exhaustive
  )

/**
 * Decorates native language-model constructor parameters so canonical finish
 * usage is observed before native response decoding, tool execution, or object
 * parsing. The original encoded finish part is forwarded unchanged, including
 * provider metadata. Streaming observation remains lazy and participates in
 * the stream's backpressure, interruption, and finalization.
 *
 * @since 0.4.0
 * @category combinators
 */
export const observe = (
  params: LanguageModel.ConstructorParams,
  observe: (usage: Response.Usage, finish: Response.FinishPartEncoded) => Effect.Effect<void>
): LanguageModel.ConstructorParams => {
  const observeEncodedPart = observePart(observe)
  return Struct.evolve(params, {
    generateText: (generateText) => (options: LanguageModel.ProviderOptions) =>
      generateText(options).pipe(
        Effect.tap((parts) => Effect.forEach(parts, observeEncodedPart, { discard: true }))
      ),
    streamText: (streamText) => (options: LanguageModel.ProviderOptions) =>
      streamText(options).pipe(Stream.tap(observeEncodedPart))
  })
}
