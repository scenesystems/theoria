/**
 * Predict-forward runtime orchestration.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as ModelSettings from "@scenesystems/effect-lm/ModelSettings"
import type { Schema } from "effect"
import { Array as Arr, Boolean, Clock, Data, Effect, Option, Struct } from "effect"
import type { Ref } from "effect"
import { ParseOutputError } from "../../../DspError.js"
import type { Module } from "../../../Module.js"
import type { PredictOptions, PredictPolicy } from "../../../Module.js"
import { type ModuleParameters, settings } from "../../../ModuleParameters.js"
import { type Signature, Text } from "../../../Signature.js"
import { RolloutRef } from "../../cache/rollout.js"
import { CurrentRole } from "../../modelRole.js"
import { path, read } from "../../parameterBinding.js"
import { buildPrompt } from "../../prompt/render.js"
import { promptToTraceText } from "../../prompt/trace.js"
import { executionId } from "../../trace/attempts.js"
import { registerRuntime, RuntimeRegistrationOptions } from "../discovery/registry.js"
import { cached } from "./cache.js"
import { ForwardOptions } from "./model.js"
import { runForward } from "./strategy.js"
import { appendTraceEntry, PayloadOptions, TraceOptions, tracePayloadFromEncoded } from "./trace.js"

/** @internal */
export class RuntimeOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly inputSchema: Signature<I, O>["inputSchema"]
  readonly outputSchema: Signature<I, O>["outputSchema"]
  readonly parametersRef: Ref.Ref<ModuleParameters>
  readonly policy: PredictPolicy
  readonly invocation: PredictOptions
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
          parameters: options.parametersRef,
          signature: new Text({
            description: options.signature.description,
            instructions: options.signature.instructions
          }),
          subModuleIds: Arr.empty()
        })
      )

      const parameters = yield* read(options.parametersRef, options.moduleName)
      const id = yield* executionId
      const startedAt = yield* Clock.currentTimeMillis
      const forward = new ForwardOptions<I, O>({
        executionId: id,
        moduleName: options.moduleName,
        signature: options.signature,
        parameters,
        input,
        outputSchema: options.outputSchema,
        policy: options.policy
      })
      const request = new ModelBinder.Request({
        settings: ModelSettings.merge(
          settings(parameters),
          Option.getOrElse(Option.fromUndefinedOr(options.invocation.settings), () => ModelSettings.empty)
        ),
        role: yield* Option.match(Option.fromUndefinedOr(options.invocation.role), {
          onNone: () => Effect.service(CurrentRole),
          onSome: (role) => Effect.succeed(role)
        }),
        rolloutId: yield* RolloutRef
      })
      const compute = runForward(forward)
      const enabled = options.invocation.cache !== "never"
      const selected = yield* Boolean.match(enabled, {
        onFalse: () => Effect.succeed(compute),
        onTrue: () =>
          path(options.parametersRef, options.moduleName).pipe(
            Effect.map((predictorPath) => cached(forward, request, predictorPath, compute))
          )
      })
      const execution = yield* selected.pipe(
        ModelBinder.bind(request),
        Effect.catchTag("ParseOutputError", (error) =>
          Effect.gen(function*() {
            return yield* new ParseOutputError(Struct.assign(error, {
              message: error.message,
              context: {
                predictorPath: yield* path(options.parametersRef, options.moduleName),
                input: yield* tracePayloadFromEncoded(
                  new PayloadOptions({
                    moduleName: options.moduleName,
                    carrier: "input",
                    schema: options.inputSchema,
                    value: input
                  })
                ),
                prompt: yield* buildPrompt(options.signature, parameters, input).pipe(
                  Effect.flatMap(promptToTraceText)
                )
              }
            }))
          }))
      )
      const completedAt = yield* Clock.currentTimeMillis

      yield* appendTraceEntry(
        new TraceOptions<I, O>({
          executionId: id,
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
