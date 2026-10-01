/**
 * Resolves a routed Hugging Face language model, generates text through the
 * selected provider, and records the selected route as runtime evidence.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunRuntime } from "@effect/platform-bun"
import { Boolean, Effect, Function, Option } from "effect"

import * as HuggingFace from "@scenesystems/effect-inference/HuggingFace"
import * as RuntimeEvidence from "@scenesystems/effect-inference/RuntimeEvidence"

export const program = Effect.gen(function*() {
  const resolution = yield* HuggingFace.resolveConfig(
    new HuggingFace.Config({
      serveMode: "routed-marketplace",
      model: "meta-llama/Llama-3.3-70B-Instruct",
      selectionPolicy: "fastest"
    })
  )
  const languageModelLayer = yield* HuggingFace.languageModel(resolution)
  const response = yield* LanguageModel.generateText({
    prompt: "Summarize descriptor-based runtime resolution in one sentence.",
    toolChoice: "none"
  }).pipe(Effect.provide(languageModelLayer))
  const evidence = RuntimeEvidence.make(resolution, {
    responseModel: Option.getOrElse(
      Option.fromNullable(resolution.route.providerModel),
      () => resolution.request.model.modelRef
    )
  })

  return yield* Effect.log({
    requestedModel: evidence.request.model.modelRef,
    selectedProvider: evidence.route.selectedProvider,
    responseModel: evidence.response.responseModel,
    text: response.text
  })
})

Boolean.match(import.meta.main, {
  onTrue: () => BunRuntime.runMain(program),
  onFalse: Function.constVoid
})
