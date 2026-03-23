/**
 * Example contract: live provider path requires caller-provided LanguageModel layer.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"

const PROVIDER_BOOTSTRAP_FAILURE = "provider-bootstrap-failed"

describe("examples/03-basic-classify-live-openai", () => {
  it.effect("fails fast when caller-provided live layer bootstrap fails", () =>
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
      const openAiLiveLayer = Layer.effect(
        LanguageModel.LanguageModel,
        Effect.fail(PROVIDER_BOOTSTRAP_FAILURE)
      )

      const error = yield* classifier.forward({ text: "I love Effect." }).pipe(
        Effect.provide(openAiLiveLayer),
        Effect.flip
      )

      expect(error).toBe(PROVIDER_BOOTSTRAP_FAILURE)
    }))
})
