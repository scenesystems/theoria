/**
 * Module.programOfThought contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

import { makeFixtureRegistry, ProgramOfThoughtSuccessFixtureSchema } from "../helpers/dspy-fixtures/index.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with short factual answers",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("Module.programOfThought", () => {
  it.effect("generates a typed plan, executes through the interpreter boundary, and returns the typed final answer", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const rawFixture = yield* registry.load("dspy.pot.success.basic")
      const fixture = yield* Schema.decodeUnknown(ProgramOfThoughtSuccessFixtureSchema)(rawFixture)
      const signature = yield* makeQaSignature()
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          fixture.payload.responses.generate,
          fixture.payload.responses.answer
        ])
      )
      const interpreterLayer = Layer.succeed(Module.ProgramInterpreter, {
        execute: () =>
          Effect.succeed(
            new Module.ProgramExecutionResult({
              codeOutput: fixture.payload.codeOutput,
              submission: null
            })
          )
      })
      const program = yield* Module.programOfThought({
        name: "qa-program-of-thought",
        signature,
        maxIterations: fixture.payload.maxIterations
      }).pipe(Effect.provide(interpreterLayer))

      const result = yield* program.forward(fixture.payload.sampleInput).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service))
      )
      const calls = yield* Ref.get(lm.calls)

      expect(result).toStrictEqual({ answer: fixture.payload.responses.answer.answer })
      expect(calls.length).toBe(2)
      expect(fixture.payload.dspyPredictionKeys).toContain("reasoning")
      expect(fixture.payload.dspyPredictionKeys).toContain("answer")
    }))
})
