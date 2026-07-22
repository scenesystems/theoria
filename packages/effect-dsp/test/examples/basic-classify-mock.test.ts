/**
 * Example contract: mock-backed classify flow.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Effect, Schema } from "effect"

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
