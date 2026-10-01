/**
 * Resolves a dedicated Hugging Face endpoint, embeds two inputs, and records
 * the configured deployment and observed embedding width. EmbeddingModel does
 * not expose a response model identity, so this does not invent one.
 */
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean, Effect, Function, Option } from "effect"

import * as HuggingFace from "@scenesystems/effect-inference/HuggingFace"

export const program = Effect.gen(function*() {
  const resolution = yield* HuggingFace.resolveConfig(
    new HuggingFace.Config({
      serveMode: "dedicated-endpoint",
      model: "sentence-transformers/all-MiniLM-L6-v2"
    })
  )
  const embeddingLayer = yield* HuggingFace.embeddingModel(resolution)
  const embeddings = yield* EmbeddingModel.EmbeddingModel.pipe(
    Effect.flatMap((model) => model.embedMany(Arr.make("runtime provenance", "package-owned evidence"))),
    Effect.provide(embeddingLayer)
  )
  const dimensions = Option.map(Arr.head(embeddings), Arr.length)

  return yield* Effect.log({
    requestedModel: resolution.request.model.modelRef,
    endpointId: Option.fromNullable(resolution.route.route.endpointId),
    deployment: Option.fromNullable(resolution.route.selectedDeployment),
    embeddingDimensions: dimensions
  })
})

Boolean.match(import.meta.main, {
  onTrue: () => BunRuntime.runMain(program),
  onFalse: Function.constVoid
})
