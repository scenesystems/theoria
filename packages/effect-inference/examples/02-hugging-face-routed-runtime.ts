/**
 * Resolves a routed Hugging Face language model, generates text through the
 * selected provider, and records the selected route as runtime evidence.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import * as HuggingFace from "@scenesystems/effect-inference/HuggingFace"
import * as Runtime from "@scenesystems/effect-inference/Runtime"

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
