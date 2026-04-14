/**
 * Example contract: mock-backed program-of-thought flow.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

describe("examples/16-program-of-thought-mock", () => {
  it.effect("solves a numeric reasoning task through a deterministic interpreter layer", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make(
        "Solve short arithmetic questions with exact numeric answers",
        {
          question: Signature.describe(Schema.String, "The arithmetic question to answer")
        },
        {
          answer: Signature.describe(Schema.String, "The exact numeric answer")
        }
      )
      const solver = yield* Module.programOfThought({
        name: "arithmetic-program-of-thought-example",
        signature,
        maxIterations: 2
      }).pipe(
        Effect.provide(
          Layer.succeed(Module.ProgramInterpreter, {
            execute: () =>
              Effect.succeed(
                new Module.ProgramExecutionResult({
                  codeOutput: "102",
                  submission: null
                })
              )
          })
        )
      )
      const result = yield* solver.forward({ question: "What is 17 * 6?" }).pipe(
        Effect.provide(
          MockLanguageModel.layer(
            LanguageModel.LanguageModel,
            MockLanguageModel.sequence([
              {
                reasoning: "I should write a tiny program that multiplies 17 by 6.",
                generated_code: "result = 17 * 6"
              },
              {
                reasoning: "The interpreter returned 102, so that is the exact answer.",
                answer: "102"
              }
            ])
          )
        )
      )

      expect(result).toStrictEqual({ answer: "102" })
    }))
})
