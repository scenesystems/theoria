/**
 * Chain-of-thought example with mock provider Layer.
 *
 * Run: bun run examples/04-chain-of-thought-mock.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"
import { Module, Signature } from "effect-dsp"
import { MockLanguageModel } from "effect-dsp/test"
import { mockLanguageModelLayer } from "./shared/mock-language-model.js"

const program = Effect.gen(function*() {
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
  const result = yield* qa.forward({ question: "What is the capital of France?" })

  yield* Effect.log("chain-of-thought-mock", result)
})

BunRuntime.runMain(
  program.pipe(
    Effect.provide(
      mockLanguageModelLayer(
        MockLanguageModel.fixed({
          reasoning: "France's capital city is Paris.",
          answer: "Paris"
        })
      )
    )
  )
)
