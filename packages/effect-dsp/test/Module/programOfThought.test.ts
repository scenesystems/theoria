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
      const interpreterRequests = yield* Ref.make<
        ReadonlyArray<{
          readonly attempt: number
          readonly code: string
          readonly moduleName: string
          readonly question: unknown
        }>
      >([])
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          fixture.payload.responses.generate,
          fixture.payload.responses.answer
        ])
      )
      const interpreterLayer = Layer.succeed(Module.ProgramInterpreter, {
        execute: (request) =>
          Ref.update(interpreterRequests, (requests) => [
            ...requests,
            {
              attempt: request.attempt,
              code: request.code,
              moduleName: request.moduleName,
              question: request.input.question
            }
          ]).pipe(
            Effect.zipRight(
              Effect.succeed(
                new Module.ProgramExecutionResult({
                  codeOutput: fixture.payload.codeOutput,
                  submission: null
                })
              )
            )
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
      const requests = yield* Ref.get(interpreterRequests)

      expect(result).toStrictEqual({ answer: fixture.payload.responses.answer.answer })
      expect(calls.length).toBe(2)
      expect(requests).toHaveLength(1)
      expect(requests[0]?.attempt).toBe(1)
      expect(requests[0]?.moduleName).toBe("qa-program-of-thought")
      expect(requests[0]?.question).toBe(fixture.payload.sampleInput.question)
      expect(requests[0]?.code).toContain("result = 1 + 1")
      expect(requests[0]?.code).toContain("SUBMIT({'answer': result})")
      expect(fixture.payload.dspyPredictionKeys).toContain("reasoning")
      expect(fixture.payload.dspyPredictionKeys).toContain("answer")
    }))
})
