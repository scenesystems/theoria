/**
 * Resolves an OpenAI text provider from explicit runtime options and logs the
 * requested route together with the provider response metadata.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunRuntime } from "@effect/platform-bun"
import { Boolean, Effect, Function, Option } from "effect"

import * as TextProvider from "@scenesystems/effect-inference/TextProvider"

export const program = TextProvider.resolve(
  new TextProvider.Options({
    provider: "openai",
    model: "gpt-4o-mini"
  })
).pipe(
  Effect.flatMap((runtime) =>
    LanguageModel.generateText({
      prompt: "Answer with exactly two words: config verified.",
      toolChoice: "none"
    }).pipe(
      Effect.provide(runtime.languageModel),
      Effect.flatMap((response) =>
        Effect.log({
          provider: runtime.provider,
          request: runtime.request,
          requestedModel: runtime.request.model.modelRef,
          route: Option.fromNullable(runtime.request.route),
          finishReason: response.finishReason,
          text: response.text
        })
      )
    )
  )
)

Boolean.match(import.meta.main, {
  onTrue: () => BunRuntime.runMain(program),
  onFalse: Function.constVoid
})
