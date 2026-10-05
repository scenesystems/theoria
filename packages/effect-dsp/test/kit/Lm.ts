import { Chunk, Data, Effect, Layer, Ref, Stream } from "effect"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import type * as Response from "effect/ai/Response"

export class RecordedRequest extends Data.Class<{
  readonly prompt: LanguageModel.ProviderOptions["prompt"]
  readonly responseFormat: LanguageModel.ProviderOptions["responseFormat"]
  readonly tools: LanguageModel.ProviderOptions["tools"]
}> {}

export type Script = (
  request: LanguageModel.ProviderOptions,
  index: number
) => Effect.Effect<Array<Response.PartEncoded>, AiError.AiError>

/** Records attempted requests before invoking the script, including failed calls. */
export const recordingLm = Effect.fnUntraced(function*(script: Script) {
  const requests = yield* Ref.make(Chunk.empty<RecordedRequest>())
  const service = yield* LanguageModel.make({
    generateText: (options) =>
      Effect.gen(function*() {
        const prior = yield* Ref.getAndUpdate(
          requests,
          Chunk.append(
            new RecordedRequest({
              prompt: options.prompt,
              responseFormat: options.responseFormat,
              tools: options.tools
            })
          )
        )
        return yield* script(options, Chunk.size(prior))
      }),
    streamText: () =>
      Stream.fail(AiError.make({
        module: "recordingLm",
        method: "streamText",
        reason: new AiError.UnknownError({ description: "Wave 0 recorder does not implement streaming" })
      }))
  })
  return { layer: Layer.succeed(LanguageModel.LanguageModel, service), requests }
})
