import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import * as HuggingFace from "../src/HuggingFace/index.js"
import * as Runtime from "../src/Runtime/index.js"

export const program = Effect.gen(function*() {
  const resolution = yield* HuggingFace.resolveLiveRuntimeFromConfig({
    serveMode: "dedicated-endpoint",
    model: "sentence-transformers/all-MiniLM-L6-v2"
  })
  const embeddingLayer = yield* HuggingFace.embeddingModelLayer(resolution)
  const embeddings = yield* EmbeddingModel.EmbeddingModel.pipe(
    Effect.flatMap((model) => model.embedMany(["runtime provenance", "package-owned evidence"])),
    Effect.provide(embeddingLayer)
  )
  const evidence = Runtime.makeRuntimeEvidence({
    resolution,
    resolvedRuntime: {
      responseModel: resolution.resolvedRoute.providerModel ?? resolution.desired.artifact.modelRef,
      providerMetadata: {
        huggingface: {
          ...((typeof embeddings[0]?.length === "number")
            ? { embeddingDimensions: embeddings[0].length }
            : {})
        }
      }
    }
  })

  return yield* Effect.log({
    requestedModel: evidence.desired.artifact.modelRef,
    endpointId: evidence.resolvedRoute.route.endpointId,
    deployment: evidence.resolvedRoute.selectedDeployment,
    responseModel: evidence.resolvedRuntime.responseModel,
    embeddingDimensions: embeddings[0]?.length
  })
})

if (import.meta.main) {
  BunRuntime.runMain(program)
}
