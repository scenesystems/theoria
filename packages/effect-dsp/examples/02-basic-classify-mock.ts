/**
 * Basic mock-backed classification flow with direct Layer provisioning.
 *
 * Run: bun run examples/02-basic-classify-mock.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"
import { Module, Signature } from "effect-dsp"
import { MockLanguageModel } from "effect-dsp/test"
import { mockLanguageModelLayer } from "./shared/mock-language-model.js"

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

  yield* Effect.log("basic-classify-mock", result)
})

BunRuntime.runMain(
  program.pipe(
    Effect.provide(
      mockLanguageModelLayer(
        MockLanguageModel.fixed({ label: "positive" })
      )
    )
  )
)
