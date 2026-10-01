/**
 * Predict-forward runtime orchestration.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Array as Arr, Clock, Data, Effect, Ref } from "effect"
import type { Module } from "../../../Module.js"
import { NodeSignature } from "../../../Module.js"
import type { PredictPolicy } from "../../../Module.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import type { Signature } from "../../../Signature.js"
import { registerRuntime, RuntimeRegistrationOptions } from "../discovery/registry.js"
import { ForwardOptions } from "./model.js"
import { runForward } from "./strategy.js"
import { appendTraceEntry, TraceOptions } from "./trace.js"

/** @internal */
export class RuntimeOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly inputSchema: Schema.Struct<I>
  readonly outputSchema: Schema.Struct<O>
  readonly paramsRef: Ref.Ref<ModuleParameters>
  readonly policy: PredictPolicy
}> {}

/**
 * Build a typed `forward` function for a predictor module.
 *
 * @since 0.1.0
 * @internal
 */
export const makeForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: RuntimeOptions<I, O>): Module<I, O>["forward"] => {
  return Effect.fn(options.moduleName)((input) =>
    Effect.gen(function*() {
      yield* registerRuntime(
        new RuntimeRegistrationOptions({
          moduleName: options.moduleName,
          params: options.paramsRef,
          signature: new NodeSignature({
            description: options.signature.description,
            instructions: options.signature.instructions
          }),
          subModuleIds: Arr.empty()
        })
      )

      const params = yield* Ref.get(options.paramsRef)
      const startedAt = yield* Clock.currentTimeMillis
      const execution = yield* runForward(
        new ForwardOptions<I, O>({
          moduleName: options.moduleName,
          signature: options.signature,
          params,
          input,
          outputSchema: options.outputSchema,
          policy: options.policy
        })
      )
      const completedAt = yield* Clock.currentTimeMillis

      yield* appendTraceEntry(
        new TraceOptions<I, O>({
          moduleName: options.moduleName,
          signature: options.signature,
          inputSchema: options.inputSchema,
          input,
          execution,
          startedAt,
          completedAt
        })
      )

      return execution.output
    })
  )
}
