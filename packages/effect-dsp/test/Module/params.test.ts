/**
 * Module params + Ref mutation contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Demo } from "effect-dsp/Example"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"

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

describe("Module params", () => {
  it.effect("allocates params Ref with default instructions and empty demos", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa", qa)
      const params = yield* Ref.get(module.params)

      expect(params.instructions).toBe(qa.instructions)
      expect(params.demos).toEqual([])
    }))

  it.effect("supports Ref mutation/read-back for demos and instructions", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa", qa)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: "Use one token answers.",
          demos: [
            new Demo({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ]
        })
      )

      const updated = yield* Ref.get(module.params)

      expect(updated.instructions).toBe("Use one token answers.")
      expect(updated.demos).toHaveLength(1)
      expect(updated.demos[0]?.output).toEqual({ answer: "Paris" })
    }))
})
