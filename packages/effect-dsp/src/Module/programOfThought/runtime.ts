/**
 * `programOfThought` forward runtime orchestration.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Schema } from "effect"

import type { ProgramCodeParseError, ProgramExecutionError } from "../../Errors/module.js"
import { ProgramRuntimeBoundaryError } from "../../Errors/module.js"
import type { DspError } from "../../Errors/union.js"
import type { Signature } from "../../Signature/model.js"
import type { ChainOfThoughtOutputFields } from "../chainOfThought/schema.js"
import type { Module } from "../model.js"
import { executeAttempt } from "./execution.js"
import type { ProgramInterpreterApi } from "./interpreter.js"
import { parseGeneratedCode } from "./parse.js"
import type { ProgramAnswerInputFields, ProgramGeneratedCodeFields, ProgramRepairInputFields } from "./signatures.js"

type GeneratedCodeResult = Schema.Schema.Type<
  Schema.Struct<ChainOfThoughtOutputFields<ProgramGeneratedCodeFields>>
>

type RetryState = Readonly<{
  readonly attempt: number
  readonly previousCode: string | null
  readonly previousError: string | null
}>

const buildRepairInput = <
  I extends Schema.Struct.Fields
>(options: {
  readonly attempt: number
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly moduleName: string
  readonly previousCode: string
  readonly previousError: string
  readonly repair: Module<ProgramRepairInputFields<I>, ChainOfThoughtOutputFields<ProgramGeneratedCodeFields>>
}) =>
  Schema.decodeUnknown(options.repair.signature.inputSchema)({
    ...options.input,
    previous_code: options.previousCode,
    error: options.previousError
  }).pipe(
    Effect.mapError(
      () =>
        new ProgramRuntimeBoundaryError({
          message: "ProgramOfThought repair-input projection failed.",
          moduleName: options.moduleName,
          attempt: options.attempt,
          code: options.previousCode
        })
    )
  )

const buildAnswerInput = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly answer: Module<ProgramAnswerInputFields<I>, ChainOfThoughtOutputFields<O>>
  readonly attempt: number
  readonly code: string
  readonly codeOutput: string
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly moduleName: string
}) =>
  Schema.decodeUnknown(options.answer.signature.inputSchema)({
    ...options.input,
    final_generated_code: options.code,
    code_output: options.codeOutput
  }).pipe(
    Effect.mapError(
      () =>
        new ProgramRuntimeBoundaryError({
          message: "ProgramOfThought answer-input projection failed.",
          moduleName: options.moduleName,
          attempt: options.attempt,
          code: options.code
        })
    )
  )

const attemptGeneratedCode = <
  I extends Schema.Struct.Fields
>(options: {
  readonly generate: Module<I, ChainOfThoughtOutputFields<ProgramGeneratedCodeFields>>
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly repair: Module<ProgramRepairInputFields<I>, ChainOfThoughtOutputFields<ProgramGeneratedCodeFields>>
  readonly state: RetryState
}): Effect.Effect<
  GeneratedCodeResult,
  AiError.AiError | DspError,
  Schema.Schema.Context<Schema.Struct<I>> | LanguageModel.LanguageModel
> =>
  Effect.gen(function*() {
    if (options.state.previousCode === null || options.state.previousError === null) {
      return yield* options.generate.forward(options.input)
    }

    const repairInput = yield* buildRepairInput({
      attempt: options.state.attempt,
      input: options.input,
      moduleName: options.repair.name,
      previousCode: options.state.previousCode,
      previousError: options.state.previousError,
      repair: options.repair
    })

    return yield* options.repair.forward(repairInput)
  })

const runWithRepair = <
  I extends Schema.Struct.Fields
>(options: {
  readonly generate: Module<I, ChainOfThoughtOutputFields<ProgramGeneratedCodeFields>>
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly inputSchema: Schema.Struct<I>
  readonly interpreter: ProgramInterpreterApi
  readonly maxIterations: number
  readonly moduleName: string
  readonly repair: Module<ProgramRepairInputFields<I>, ChainOfThoughtOutputFields<ProgramGeneratedCodeFields>>
  readonly state: RetryState
}): Effect.Effect<
  { readonly code: string; readonly codeOutput: string },
  AiError.AiError | DspError | ProgramCodeParseError | ProgramExecutionError | ProgramRuntimeBoundaryError,
  Schema.Schema.Context<Schema.Struct<I>> | LanguageModel.LanguageModel
> =>
  Effect.gen(function*() {
    const planned = yield* attemptGeneratedCode(options)
    const code = yield* parseGeneratedCode({
      attempt: options.state.attempt,
      generatedCode: planned.generated_code,
      moduleName: options.moduleName
    })

    return yield* executeAttempt({
      attempt: options.state.attempt,
      code,
      input: options.input,
      inputSchema: options.inputSchema,
      interpreter: options.interpreter,
      moduleName: options.moduleName
    })
  }).pipe(
    Effect.catchTag("ProgramCodeParseError", (error) =>
      options.state.attempt >= options.maxIterations
        ? Effect.fail(error)
        : runWithRepair({
          ...options,
          state: {
            attempt: options.state.attempt + 1,
            previousCode: error.parsedCode,
            previousError: error.message
          }
        })),
    Effect.catchTag("ProgramExecutionError", (error) =>
      options.state.attempt >= options.maxIterations
        ? Effect.fail(error)
        : runWithRepair({
          ...options,
          state: {
            attempt: options.state.attempt + 1,
            previousCode: error.code,
            previousError: error.message
          }
        }))
  )

/**
 * Typed runtime ownership surface for `Module.programOfThought`.
 *
 * @since 0.2.0
 * @internal
 */
export const ProgramOfThoughtRuntime = {
  forward: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields
  >(options: {
    readonly answer: Module<ProgramAnswerInputFields<I>, ChainOfThoughtOutputFields<O>>
    readonly generate: Module<I, ChainOfThoughtOutputFields<ProgramGeneratedCodeFields>>
    readonly interpreter: ProgramInterpreterApi
    readonly maxIterations: number
    readonly moduleName: string
    readonly repair: Module<ProgramRepairInputFields<I>, ChainOfThoughtOutputFields<ProgramGeneratedCodeFields>>
    readonly signature: Signature<I, O>
  }): Module<I, O>["forward"] =>
    Effect.fn(options.moduleName)((input) =>
      Effect.gen(function*() {
        const execution = yield* runWithRepair({
          generate: options.generate,
          input,
          inputSchema: options.signature.inputSchema,
          interpreter: options.interpreter,
          maxIterations: options.maxIterations,
          moduleName: options.moduleName,
          repair: options.repair,
          state: {
            attempt: 1,
            previousCode: null,
            previousError: null
          }
        })
        const answerInput = yield* buildAnswerInput({
          answer: options.answer,
          attempt: execution.codeOutput.length > -1 ? 1 : 1,
          code: execution.code,
          codeOutput: execution.codeOutput,
          input,
          moduleName: options.answer.name
        })
        const answer = yield* options.answer.forward(answerInput)

        return yield* Schema.decodeUnknown(options.signature.outputSchema)(answer).pipe(
          Effect.mapError(
            () =>
              new ProgramRuntimeBoundaryError({
                message: "ProgramOfThought final answer projection failed.",
                moduleName: options.moduleName,
                attempt: 1,
                code: execution.code
              })
          )
        )
      })
    )
}
