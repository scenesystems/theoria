/**
 * Example contract: chain-of-thought flow with mock provider layer.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

describe("examples/04-chain-of-thought-mock", () => {
  it.effect("returns reasoning and answer fields via direct layer provisioning", () =>
    Effect.gen(function*() {
      const qaSignature = yield* Signature.make(
        "Answer factual questions with concise responses",
        {
          question: Signature.describe(Schema.String, "Question to answer")
        },
        {
          answer: Signature.describe(Schema.String, "Final concise answer")
        }
      )

      const qa = yield* Module.chainOfThought("qa-cot", qaSignature)
      const result = yield* qa.forward({ question: "What is the capital of France?" }).pipe(
        Effect.provide(
          MockLanguageModel.layer(
            LanguageModel.LanguageModel,
            MockLanguageModel.fixed({
              reasoning: "France's capital city is Paris.",
              answer: "Paris"
            })
          )
        )
      )

      expect(result).toEqual({
        reasoning: "France's capital city is Paris.",
        answer: "Paris"
      })
    }))
})
