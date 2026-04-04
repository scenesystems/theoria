/**
 * Predict-forward runtime orchestration.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import type { Schema } from "effect"
import { Array as Arr, Clock, Effect, Ref } from "effect"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import type { DspError } from "../../Errors/union.js"
import type { Signature } from "../../Signature/model.js"
import { RegisteredSignature, registerRuntime } from "../discovery/index.js"
import type { Module } from "../model.js"
import type { PredictPolicy } from "./policy.js"
import { runForward } from "./strategy.js"
import { appendTraceEntry } from "./trace.js"

/**
 * Build a typed `forward` function for a predictor module.
 *
 * @since 0.1.0
 * @internal
 */
export const makeForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly inputSchema: Schema.Struct<I>
  readonly outputSchema: Schema.Struct<O>
  readonly paramsRef: Ref.Ref<ModuleParams>
  readonly policy: PredictPolicy
}): Module<I, O>["forward"] => {
  return Effect.fn(options.moduleName)((input) =>
    Effect.gen(function*() {
      yield* registerRuntime({
        moduleName: options.moduleName,
        params: options.paramsRef,
        signature: new RegisteredSignature({
          description: options.signature.description,
          instructions: options.signature.instructions
        }),
        subModuleIds: Arr.empty()
      })

      const params = yield* Ref.get(options.paramsRef)
      const startedAt = yield* Clock.currentTimeMillis
      const execution = yield* runForward<I, O>({
        moduleName: options.moduleName,
        signature: options.signature,
        params,
        input,
        outputSchema: options.outputSchema,
        policy: options.policy
      }).pipe(
        Effect.mapError((error): AiError.AiError | DspError => error)
      )
      const completedAt = yield* Clock.currentTimeMillis

      yield* appendTraceEntry<I, O>({
        moduleName: options.moduleName,
        signature: options.signature,
        inputSchema: options.inputSchema,
        input,
        execution,
        startedAt,
        completedAt,
        cached: false
      })

      return execution.output
    })
  )
}
