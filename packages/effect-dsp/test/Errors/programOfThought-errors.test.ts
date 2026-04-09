/**
 * Module.programOfThought error contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Layer, Schema } from "effect"
import * as Errors from "effect-dsp/Errors"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"

import {
  FixtureRegistry,
  ProgramOfThoughtParseErrorFixtureSchema,
  ProgramOfThoughtRepairFixtureSchema,
  ProgramOfThoughtSuccessFixtureSchema
} from "../helpers/dspy-fixtures/index.js"
import { shortFactualAnswersQaSignature } from "../helpers/qa-signatures.js"

describe("ProgramOfThought errors", () => {
  it.effect("surfaces parse failures as ProgramCodeParseError", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.pot.parse-error.basic")
      const fixture = yield* Schema.decodeUnknown(ProgramOfThoughtParseErrorFixtureSchema)(rawFixture)
      const signature = yield* shortFactualAnswersQaSignature
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(fixture.payload.responses.generate)
      )
      const program = yield* Module.programOfThought({
        name: "qa-program-of-thought-parse-error",
        signature,
        maxIterations: 1
      }).pipe(
        Effect.provide(
          Layer.succeed(Module.ProgramInterpreter, {
            execute: () => Effect.die("interpreter-should-not-run")
          })
        )
      )

      const result = yield* Effect.exit(
        program.forward({ question: "What is 1+1?" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service))
        )
      )

      expect(result).toStrictEqual(
        Exit.fail(
          new Errors.ProgramCodeParseError({
            message: fixture.payload.expectedError,
            moduleName: "qa-program-of-thought-parse-error",
            attempt: 1,
            rawCode: fixture.payload.responses.generate.generated_code ?? "",
            parsedCode: "invalid=python=code"
          })
        )
      )
    }))

  it.effect("surfaces execution failures as ProgramExecutionError", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.pot.repair-cycle.basic")
      const fixture = yield* Schema.decodeUnknown(ProgramOfThoughtRepairFixtureSchema)(rawFixture)
      const signature = yield* shortFactualAnswersQaSignature
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(fixture.payload.responses.generate)
      )
      const program = yield* Module.programOfThought({
        name: "qa-program-of-thought-execution-error",
        signature,
        maxIterations: 1
      }).pipe(
        Effect.provide(
          Layer.succeed(Module.ProgramInterpreter, {
            execute: (request) =>
              Effect.fail(
                new Errors.ProgramExecutionError({
                  message: fixture.payload.executionError,
                  moduleName: request.moduleName,
                  attempt: request.attempt,
                  code: request.code
                })
              )
          })
        )
      )

      const message = yield* program.forward({ question: "What is 1+1?" }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service)),
        Effect.catchTag("ProgramExecutionError", (error) => Effect.succeed(error.message))
      )

      expect(message).toBe(fixture.payload.executionError)
    }))

  it.effect("surfaces interpreter-boundary failures as ProgramRuntimeBoundaryError", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.pot.success.basic")
      const fixture = yield* Schema.decodeUnknown(ProgramOfThoughtSuccessFixtureSchema)(rawFixture)
      const signature = yield* shortFactualAnswersQaSignature
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(fixture.payload.responses.generate)
      )
      const program = yield* Module.programOfThought({
        name: "qa-program-of-thought-boundary-error",
        signature,
        maxIterations: 1
      }).pipe(
        Effect.provide(
          Layer.succeed(Module.ProgramInterpreter, {
            execute: (request) =>
              Effect.fail(
                new Errors.ProgramRuntimeBoundaryError({
                  message: "interpreter connection lost",
                  moduleName: request.moduleName,
                  attempt: request.attempt,
                  code: request.code
                })
              )
          })
        )
      )

      const message = yield* program.forward(fixture.payload.sampleInput).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service)),
        Effect.catchTag("ProgramRuntimeBoundaryError", (error) => Effect.succeed(error.message))
      )

      expect(message).toBe("interpreter connection lost")
    }))
})
