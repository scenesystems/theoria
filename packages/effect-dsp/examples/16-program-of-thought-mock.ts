/**
 * Mock-backed numeric reasoning with `Module.programOfThought`.
 *
 * Run: bun run examples/16-program-of-thought-mock.ts
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, Schema } from "effect"
import { Module, Signature } from "effect-dsp"
import { MockLanguageModel } from "effect-dsp/test"

const program = Effect.gen(function*() {
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
    name: "arithmetic-program-of-thought",
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
      Layer.succeed(
        LanguageModel.LanguageModel,
        yield* MockLanguageModel.make(
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
        ).pipe(Effect.map((mock) => mock.service))
      )
    )
  )

  yield* Effect.log("program-of-thought-mock", result)
})

BunRuntime.runMain(program)
