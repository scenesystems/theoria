/**
 * Live-provider classify flow using shared Config-driven runtime composition.
 *
 * Required env:
 *   DSP_PROVIDER=openai
 *   OPENAI_API_KEY=...
 *
 * Optional env:
 *   OPENAI_MODEL=gpt-4o-mini
 *   OPENAI_API_URL=https://api.openai.com/v1
 *
 * Run: bun run examples/03-basic-classify-live-openai.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"
import { Module, Signature } from "effect-dsp"

import { withLiveLanguageModel } from "./shared/live-provider-runtime.js"

const program = Effect.gen(function*() {
  const classifierSignature = yield* Signature.make(
    "Classify a short sentence as positive or negative",
    {
      text: Signature.describe(Schema.String, "Sentence to classify")
    },
    {
      label: Signature.describe(Schema.String, "Sentiment label")
    }
  )

  const classifier = yield* Module.predict("sentiment-classifier", classifierSignature)
  const result = yield* classifier.forward({ text: "I love Effect." })

  yield* Effect.log("basic-classify-live-openai", result)
})

BunRuntime.runMain(
  withLiveLanguageModel(program, {
    provider: "openai"
  })
)
