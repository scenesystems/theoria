import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import * as HuggingFace from "../src/HuggingFace/index.js"
import * as Runtime from "../src/Runtime/index.js"

export const program = Effect.gen(function*() {
  const resolution = yield* HuggingFace.resolveLiveRuntimeFromConfig({
    serveMode: "routed-marketplace",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    selectionPolicy: "fastest"
  })
  const languageModelLayer = yield* HuggingFace.languageModelLayer(resolution)
  const response = yield* LanguageModel.generateText({
    prompt: "Summarize descriptor-based runtime resolution in one sentence.",
    toolChoice: "none"
  }).pipe(Effect.provide(languageModelLayer))
  const evidence = Runtime.makeRuntimeEvidence({
    resolution,
    resolvedRuntime: {
      responseModel: resolution.resolvedRoute.providerModel ?? resolution.desired.artifact.modelRef
    }
  })

  return yield* Effect.log({
    requestedModel: evidence.desired.artifact.modelRef,
    selectedProvider: evidence.resolvedRoute.selectedProvider,
    responseModel: evidence.resolvedRuntime.responseModel,
    text: response.text
  })
})

if (import.meta.main) {
  BunRuntime.runMain(program)
}
