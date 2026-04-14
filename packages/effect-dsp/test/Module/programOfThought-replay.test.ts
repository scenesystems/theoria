/**
 * Module.programOfThought replay contracts.
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

const normalizeTrace = (entries: ReadonlyArray<Trace.Entry>) =>
  Arr.map(entries, (entry) => ({
    moduleName: entry.moduleName,
    inputKeys: Record.keys(entry.input),
    outputKeys: Record.keys(entry.output),
    prompt: entry.prompt,
    rawResponse: entry.rawResponse
  }))

describe("Module.programOfThought replay", () => {
  it.effect("replays the same plan, repair path, and final answer after save/load under deterministic fixtures", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.pot.repair-cycle.basic")
      const fixture = yield* Schema.decodeUnknown(ProgramOfThoughtRepairFixtureSchema)(rawFixture)
      const signature = yield* shortFactualAnswersQaSignature

      const buildProgram = () =>
        Module.programOfThought({
          name: "qa-program-of-thought-replay",
          signature,
          maxIterations: fixture.payload.maxIterations
        }).pipe(
          Effect.provide(
            Layer.succeed(Module.ProgramInterpreter, {
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
          )
        )

      const runProgram = (
        program: Module.Module<{ readonly question: typeof Schema.String }, { readonly answer: typeof Schema.String }>
      ) =>
        Effect.gen(function*() {
          const lm = yield* MockLanguageModel.make(
            MockLanguageModel.sequence([
              fixture.payload.responses.generate,
              fixture.payload.responses.repair,
              fixture.payload.responses.answer
            ])
          )

          return yield* Module.withDiscoveryScope(
            Trace.withTracing(
              program.forward(fixture.payload.sampleInput).pipe(
                Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service))
              )
            )
          )
        })

      const firstProgram = yield* buildProgram()
      const firstRun = yield* runProgram(firstProgram)
      const saved = yield* Module.save(firstProgram)
      const secondProgram = yield* buildProgram()

      yield* Module.load(secondProgram, saved)

      const secondRun = yield* runProgram(secondProgram)

      expect(firstRun[0]).toStrictEqual(secondRun[0])
      expect(normalizeTrace(firstRun[1])).toStrictEqual(normalizeTrace(secondRun[1]))
    }))
})
