/**
 * Module.multiChainComparison contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("Module.multiChainComparison", () => {
  it.effect("runs multiple chain-of-thought candidates and returns one final typed prediction", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { reasoning: "Candidate one reasoning", answer: "Candidate one" },
          { reasoning: "Candidate two reasoning", answer: "Candidate two" },
          { reasoning: "Candidate three reasoning", answer: "Candidate three" },
          { reasoning: "Candidate two best matches the question.", answer: "Candidate two" }
        ])
      )
      const module = yield* Module.multiChainComparison({
        name: "qa-multi-chain",
        signature,
        candidateCount: 3,
        concurrency: 2,
        seed: 7
      })

      const result = yield* module.forward({ question: "What is the capital of France?" }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service))
      )
      const calls = yield* Ref.get(lm.calls)

      expect(result).toStrictEqual({ answer: "Candidate two" })
      expect(calls).toHaveLength(4)
      expect(calls[0]?.method).toBe("generateObject")
      expect(calls[3]?.method).toBe("generateObject")
    }))
})
