/**
 * Interpreter-boundary execution helpers for `programOfThought`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Effect } from "effect"

import { encodeAndProjectFieldRecord } from "../../contracts/PayloadProjection.js"
import { ProgramExecutionError, ProgramRuntimeBoundaryError } from "../../Errors/module.js"
import type { ProgramInterpreterApi } from "./interpreter.js"

const traceInputFromEncoded = <A, I, R>(options: {
  readonly attempt: number
  readonly moduleName: string
  readonly schema: Schema.Schema<A, I, R>
  readonly value: A
}) =>
  encodeAndProjectFieldRecord(
    options.schema,
    options.value,
    () =>
      new ProgramRuntimeBoundaryError({
        message: "ProgramOfThought input projection failed before execution.",
        moduleName: options.moduleName,
        attempt: options.attempt,
        code: ""
      })
  )

/**
 * Execute a normalized program body through the captured interpreter boundary.
 *
 * @since 0.2.0
 * @category combinators
 * @internal
 */
export const executeAttempt = <
  I extends Schema.Struct.Fields
>(options: {
  readonly attempt: number
  readonly code: string
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly inputSchema: Schema.Struct<I>
  readonly interpreter: ProgramInterpreterApi
  readonly moduleName: string
}): Effect.Effect<
  { readonly code: string; readonly codeOutput: string },
  ProgramExecutionError | ProgramRuntimeBoundaryError,
  Schema.Schema.Context<Schema.Struct<I>>
> =>
  Effect.gen(function*() {
    const projectedInput = yield* traceInputFromEncoded({
      attempt: options.attempt,
      moduleName: options.moduleName,
      schema: options.inputSchema,
      value: options.input
    })
    const result = yield* options.interpreter.execute({
      moduleName: options.moduleName,
      attempt: options.attempt,
      code: options.code,
      input: projectedInput
    })

    return {
      code: options.code,
      codeOutput: result.codeOutput
    }
  }).pipe(
    Effect.mapError((error) =>
      error._tag === "ProgramRuntimeBoundaryError"
        ? error
        : new ProgramExecutionError({
          message: error.message,
          moduleName: error.moduleName,
          attempt: error.attempt,
          code: error.code
        })
    )
  )
