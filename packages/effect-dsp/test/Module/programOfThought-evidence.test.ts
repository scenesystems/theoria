/**
 * Module.programOfThought evidence contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Errors from "effect-dsp/Errors"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

import { FixtureRegistry, ProgramOfThoughtRepairFixtureSchema } from "../helpers/dspy-fixtures/index.js"
import { shortFactualAnswersQaSignature } from "../helpers/qa-signatures.js"

describe("Module.programOfThought evidence surface", () => {
  it.effect("projects planning, repair, and final-answer phases through stable optimization evidence contracts", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.pot.repair-cycle.basic")
      const fixture = yield* Schema.decodeUnknown(ProgramOfThoughtRepairFixtureSchema)(rawFixture)
      const signature = yield* shortFactualAnswersQaSignature
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          fixture.payload.responses.generate,
          fixture.payload.responses.repair,
          fixture.payload.responses.answer
        ])
      )
      const interpreterLayer = Layer.succeed(Module.ProgramInterpreter, {
        execute: (request) =>
          request.attempt === 1
            ? Effect.fail(
              new Errors.ProgramExecutionError({
                message: fixture.payload.executionError,
                moduleName: request.moduleName,
                attempt: request.attempt,
                code: request.code
              })
            )
            : Effect.succeed(
              new Module.ProgramExecutionResult({
                codeOutput: fixture.payload.codeOutput,
                submission: null
              })
            )
      })
      const program = yield* Module.programOfThought({
        name: "qa-program-of-thought-evidence",
        signature,
        maxIterations: fixture.payload.maxIterations
      }).pipe(Effect.provide(interpreterLayer))

      const execution = yield* Trace.withUsageTracking(
        Trace.withTracing(
          program.forward(fixture.payload.sampleInput).pipe(
            Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service))
          )
        )
      )
      const traces = execution[0][1]
      const usage = execution[1]
      const projections = yield* Effect.forEach(traces, Contracts.OptimizationObjectiveSurface.fromTraceEntry)
      const encoded = yield* Effect.forEach(
        projections,
        (projection) => Schema.encode(Contracts.OptimizationObjectiveSurface)(projection)
      )
      const decoded = yield* Effect.forEach(
        encoded,
        (projection) => Schema.decode(Contracts.OptimizationObjectiveSurface)(projection)
      )

      expect(usage.callCount).toBe(3)
      expect(usage.cachedCount).toBe(0)
      expect(projections).toHaveLength(3)
      expect(projections[0]?.output.generated_code).toContain("SUBMIT")
      expect(projections[1]?.output.generated_code).toContain("SUBMIT")
      expect(projections[2]?.input.final_generated_code).toContain("SUBMIT")
      expect(projections[2]?.input.code_output).toBe(fixture.payload.codeOutput)
      expect(projections[2]?.output.answer).toBe(fixture.payload.responses.answer.answer)
      expect(decoded).toStrictEqual(projections)
    }))
})
