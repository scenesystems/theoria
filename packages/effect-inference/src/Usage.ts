/**
 * Usage observation for native Effect AI language-model constructors.
 *
 * @since 0.4.0
 * @module
 */
import type * as AiError from "effect/ai/AiError"
import type * as IdGenerator from "effect/ai/IdGenerator"
import type * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

type PartEncoded = Response.PartEncoded | Response.StreamPartEncoded

/** Provider hooks accepted by the usage observer. @since 0.5.0 @category models */
export class ConstructorParams extends Data.Class<{
  readonly generateText: (
    options: LanguageModel.ProviderOptions
  ) => Effect.Effect<Array<Response.PartEncoded>, AiError.AiError, IdGenerator.IdGenerator>
  readonly streamText: (
    options: LanguageModel.ProviderOptions
  ) => Stream.Stream<Response.StreamPartEncoded, AiError.AiError, IdGenerator.IdGenerator>
  readonly codecTransformer?: LanguageModel.CodecTransformer
}> {}

const observePart = (
  observe: (usage: Response.Usage, finish: Response.FinishPartEncoded) => Effect.Effect<void>
) =>
  Match.type<PartEncoded>().pipe(
    Match.when({ type: "finish" }, (finish) =>
      observe(
        new Response.Usage(finish.usage),
        finish
      )),
    Match.orElse(() => Effect.void)
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
  params: ConstructorParams,
  observe: (usage: Response.Usage, finish: Response.FinishPartEncoded) => Effect.Effect<void>
): ConstructorParams => {
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
