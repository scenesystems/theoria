/**
 * Module.programOfThought trace contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Record, Schema } from "effect"
import * as Errors from "effect-dsp/Errors"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

import { FixtureRegistry, ProgramOfThoughtRepairFixtureSchema } from "../helpers/dspy-fixtures/index.js"
import { shortFactualAnswersQaSignature } from "../helpers/qa-signatures.js"

const normalizeTraceShape = (entries: ReadonlyArray<Trace.Entry>) =>
  Arr.map(entries, (entry) => ({
    inputKeys: Record.keys(entry.input),
    predictionKeys: Record.keys(entry.output)
  }))

describe("Module.programOfThought trace surface", () => {
  it.effect("captures generated code, repair inputs, execution output, and final projection through stable trace entries", () =>
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
        name: "qa-program-of-thought-trace",
        signature,
        maxIterations: fixture.payload.maxIterations
      }).pipe(Effect.provide(interpreterLayer))

      const traced = yield* Trace.withTracing(
        program.forward(fixture.payload.sampleInput).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service))
        )
      )
      const entries = traced[1]
      const normalized = normalizeTraceShape(entries)

      expect(normalized[0]).toStrictEqual(fixture.payload.traceEntries[0])
      expect(normalized[1]).toStrictEqual(fixture.payload.traceEntries[1])
      expect(normalized[2]?.predictionKeys).toStrictEqual(fixture.payload.traceEntries[2]?.predictionKeys)
      expect(normalized[2]?.inputKeys).toContain("final_generated_code")
      expect(normalized[2]?.inputKeys).toContain("code_output")
      expect(entries[2]?.input.code_output).toBe(fixture.payload.codeOutput)
      expect(entries.every((entry) => entry.prompt.length > 0)).toBe(true)
      expect(entries.every((entry) => entry.rawResponse.length > 0)).toBe(true)
    }))
})
