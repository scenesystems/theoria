import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import type { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import type { Role } from "@scenesystems/effect-lm/Role"
import { Chunk, Context, Data, Effect, Layer, Option, Ref, Stream } from "effect"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import type * as Response from "effect/ai/Response"

export class RecordedRequest extends Data.Class<{
  readonly prompt: LanguageModel.ProviderOptions["prompt"]
  readonly responseFormat: LanguageModel.ProviderOptions["responseFormat"]
  readonly tools: LanguageModel.ProviderOptions["tools"]
  readonly settings: Option.Option<ModelSettings>
  readonly role: Option.Option<Role>
  readonly rolloutId: Option.Option<number>
}> {}

const CurrentRequest = Context.Reference<Option.Option<ModelBinder.Request>>("test/kit/Lm/Request", {
  defaultValue: Option.none
})

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
        const request = yield* CurrentRequest
        const prior = yield* Ref.getAndUpdate(
          requests,
          Chunk.append(
            new RecordedRequest({
              prompt: options.prompt,
              responseFormat: options.responseFormat,
              tools: options.tools,
              settings: Option.map(request, (value) => value.settings),
              role: Option.map(request, (value) => value.role),
              rolloutId: Option.flatMap(request, (value) => value.rolloutId)
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
  return {
    layer: Layer.merge(
      Layer.succeed(LanguageModel.LanguageModel, service),
      Layer.succeed(
        ModelBinder.Current,
        new ModelBinder.Binder({
          bind: (request) => Effect.provideService(CurrentRequest, Option.some(request))
        })
      )
    ),
    requests
  }
})
