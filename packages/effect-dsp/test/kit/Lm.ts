import { Chunk, Data, Effect, Layer, Option, Ref, Schema, Stream } from "effect"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import type * as Response from "effect/ai/Response"

// Test-only placeholders until the shared effect-lm contract lands in Wave 1.
const ModelSettings = Schema.Struct({
  temperature: Schema.optional(Schema.Finite),
  maxTokens: Schema.optional(Schema.Int),
  topP: Schema.optional(Schema.Finite),
  stop: Schema.optional(Schema.Array(Schema.String)),
  seed: Schema.optional(Schema.Int)
})
const Role = Schema.Literals(["task", "teacher", "proposer", "evaluator", "critic"])

export class RecordedRequest extends Data.Class<{
  readonly prompt: LanguageModel.ProviderOptions["prompt"]
  readonly responseFormat: LanguageModel.ProviderOptions["responseFormat"]
  readonly tools: LanguageModel.ProviderOptions["tools"]
  readonly settings: Option.Option<typeof ModelSettings.Type>
  readonly role: Option.Option<typeof Role.Type>
  readonly rolloutId: Option.Option<number>
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
              tools: options.tools,
              settings: Option.none(),
              role: Option.none(),
              rolloutId: Option.none()
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
