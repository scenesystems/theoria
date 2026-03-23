/**
 * Example contract: mock-backed classify flow.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

describe("examples/02-basic-classify-mock", () => {
  it.effect("produces deterministic classify output with a direct mock layer", () =>
    Effect.gen(function*() {
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
      const result = yield* classifier.forward({ text: "I love Effect." }).pipe(
        Effect.provide(
          MockLanguageModel.layer(
            LanguageModel.LanguageModel,
            MockLanguageModel.fixed({ label: "positive" })
          )
        )
      )

      expect(result).toEqual({ label: "positive" })
    }))
})
