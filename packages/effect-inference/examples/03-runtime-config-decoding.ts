import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import * as Runtime from "../src/Runtime/index.js"

export const program = Runtime.resolveLiveTextProviderRuntime({
  provider: "openai",
  model: "gpt-4o-mini"
}).pipe(
  Effect.flatMap((runtime) =>
    LanguageModel.generateText({
      prompt: "Answer with exactly two words: config verified.",
      toolChoice: "none"
    }).pipe(
      Effect.provide(runtime.languageModelLayer),
      Effect.flatMap((response) =>
        Effect.log({
          provider: runtime.provider,
          requestedRuntime: runtime.desired,
          requestedModel: runtime.desired.artifact.modelRef,
          routeFamily: runtime.desired.route?.family,
          baseUrl: runtime.desired.route?.baseUrl,
          finishReason: response.finishReason,
          text: response.text
        })
      )
    )
  )
)

if (import.meta.main) {
  BunRuntime.runMain(program)
}
