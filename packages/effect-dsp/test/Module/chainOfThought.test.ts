/**
 * Module.chainOfThought contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Record, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Demo } from "effect-dsp/Example"
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

describe("Module.chainOfThought", () => {
  it.effect("extends the output contract with reasoning and preserves structured predict runtime behavior", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({
          reasoning: "Paris is the capital city of France.",
          answer: "Paris"
        })
      )
      const cot = yield* Module.chainOfThought("qa-cot", qa)

      const result = yield* cot.forward({
        question: "What is the capital of France?"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )
      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({
        reasoning: "Paris is the capital city of France.",
        answer: "Paris"
      })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe("generateObject")
      expect(Record.keys(cot.signature.outputFields)).toEqual(["reasoning", "answer"])
      expect(cot.signature.instructions).toContain("reasoning")
    }))

  it.effect("uses the same text-mode prompt/parse contracts as predict when demos are present", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(
          "[[ ## reasoning ## ]]\nParis is the capital city of France.\n\n[[ ## answer ## ]]\nParis"
        )
      )
      const cot = yield* Module.chainOfThought("qa-cot", qa)

      yield* Ref.update(
        cot.params,
        (params) =>
          new ModuleParams({
            instructions: params.instructions,
            outputStrategy: "auto",
            demos: [
              new Demo({
                input: { question: "What is the capital of France?" },
                output: {
                  reasoning: "France's capital city is Paris.",
                  answer: "Paris"
                }
              })
            ]
          })
      )

      const result = yield* cot.forward({
        question: "What is the capital of Japan?"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )
      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({
        reasoning: "Paris is the capital city of France.",
        answer: "Paris"
      })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe("generateText")
      expect(calls[0]?.prompt).toContain("[[ ## reasoning ## ]]")
      expect(calls[0]?.prompt).toContain("[[ ## answer ## ]]")
    }))
})
