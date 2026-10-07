/**
 * ReAct runtime orchestration.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import type { Record } from "effect"
import { Array as Arr, Boolean, Clock, Data, Effect, Number, Option, Result, Schema } from "effect"
import type { Ref } from "effect"
import * as Prompt from "effect/ai/Prompt"
import type * as Tool from "effect/ai/Tool"
import type * as Toolkit from "effect/ai/Toolkit"
import { type ParseFieldDiagnostic, ParseOutputError } from "../../../DspError.js"
import type { Module } from "../../../Module.js"
import { type ModuleParameters, settings } from "../../../ModuleParameters.js"
import { type Signature, Text } from "../../../Signature.js"
import { RolloutRef } from "../../cache/rollout.js"
import { callLmTextResponse } from "../../lm.js"
import { CurrentRole } from "../../modelRole.js"
import { path, read } from "../../parameterBinding.js"
import { parseTextOutput } from "../../parse/decode.js"
import { buildPrompt } from "../../prompt/render.js"
import { promptToTraceText } from "../../prompt/trace.js"
import { executionId } from "../../trace/attempts.js"
import { registerRuntime, RuntimeRegistrationOptions } from "../discovery/registry.js"
import { PayloadOptions, tracePayloadFromEncoded } from "../predict/trace.js"
import {
  appendReactTraceEntry,
  makeIterationFeedback,
  makeToolObservationFeedback,
  ReactLoopState,
  ReactTraceOptions
} from "./step.js"

const iterateEffect = <A, E, R>(
  state: A,
  predicate: (state: A) => boolean,
  body: (state: A) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Boolean.match(predicate(state), {
    onFalse: () => Effect.succeed(state),
    onTrue: () => Effect.flatMap(body(state), (next) => Effect.suspend(() => iterateEffect(next, predicate, body)))
  })

/** @internal */
export class ReactRuntimeOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record.ReadonlyRecord<string, Tool.Any>
> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly inputSchema: Signature<I, O>["inputSchema"]
  readonly outputSchema: Signature<I, O>["outputSchema"]
  readonly parametersRef: Ref.Ref<ModuleParameters>
  readonly toolkit: Toolkit.WithHandler<Tools>
  readonly maxIterations: number
}> {}

/**
 * Build a typed `forward` function for a ReAct module.
 *
 * @since 0.1.0
 * @internal
 */
export const makeReactForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record.ReadonlyRecord<string, Tool.Any>
>(options: ReactRuntimeOptions<I, O, Tools>): Module<
  I,
  O,
  Tool.HandlerError<Tools[keyof Tools]>,
  Tool.HandlerServices<Tools[keyof Tools]>
>["forward"] => {
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
      const traceInput = yield* tracePayloadFromEncoded(
        new PayloadOptions({
          moduleName: options.moduleName,
          carrier: "input",
          schema: options.inputSchema,
          value: input
        })
      )

      const initialState = new ReactLoopState<Schema.Schema.Type<Schema.Struct<O>>>({
        iteration: 0,
        prompt: yield* buildPrompt(options.signature, parameters, input),
        output: Option.none(),
        lastRawResponse: Option.none(),
        lastDiagnostics: Arr.empty(),
        lastTurnWasToolCall: false
      })

      const finalState = yield* iterateEffect(
        initialState,
        (state) => Boolean.and(Number.isLessThan(state.iteration, options.maxIterations), Option.isNone(state.output)),
        (state) =>
          Effect.gen(function*() {
            const prompt = state.prompt
            const startedAt = yield* Clock.currentTimeMillis
            const [response, usage] = yield* callLmTextResponse(
              prompt,
              Boolean.match(state.lastTurnWasToolCall, {
                onTrue: () => Option.none(),
                onFalse: () => Option.some(options.toolkit)
              })
            ).pipe(ModelBinder.bind(
              new ModelBinder.Request({
                settings: settings(parameters),
                role: yield* CurrentRole,
                rolloutId: yield* RolloutRef
              })
            ))
            const completedAt = yield* Clock.currentTimeMillis
            const continuation = Prompt.concat(prompt, Prompt.fromResponseParts(response.content))

            return yield* Boolean.match(Number.isGreaterThan(Arr.length(response.toolCalls), 0), {
              onTrue: () =>
                appendReactTraceEntry(
                  new ReactTraceOptions<I, O, Tools>({
                    executionId: id,
                    moduleName: options.moduleName,
                    signature: options.signature,
                    traceInput,
                    outputSchema: options.outputSchema,
                    output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                    parseError: Option.none(),
                    prompt,
                    response,
                    usage,
                    startedAt,
                    completedAt
                  })
                ).pipe(
                  Effect.as(
                    new ReactLoopState({
                      iteration: Number.increment(state.iteration),
                      prompt: Prompt.concat(continuation, makeToolObservationFeedback(state.iteration)),
                      output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                      lastRawResponse: Option.some(response.text),
                      lastDiagnostics: Arr.empty<ParseFieldDiagnostic>(),
                      lastTurnWasToolCall: true
                    })
                  )
                ),
              onFalse: () =>
                Effect.gen(function*() {
                  const parsed = yield* Effect.result(
                    parseTextOutput(options.moduleName, options.outputSchema, response.text)
                  )

                  return yield* Result.match(parsed, {
                    onSuccess: (output) =>
                      appendReactTraceEntry(
                        new ReactTraceOptions<I, O, Tools>({
                          executionId: id,
                          moduleName: options.moduleName,
                          signature: options.signature,
                          traceInput,
                          outputSchema: options.outputSchema,
                          output: Option.some(output),
                          parseError: Option.none(),
                          prompt,
                          response,
                          usage,
                          startedAt,
                          completedAt
                        })
                      ).pipe(
                        Effect.as(
                          new ReactLoopState({
                            iteration: Number.increment(state.iteration),
                            prompt: continuation,
                            output: Option.some(output),
                            lastRawResponse: Option.some(response.text),
                            lastDiagnostics: Arr.empty<ParseFieldDiagnostic>(),
                            lastTurnWasToolCall: false
                          })
                        )
                      ),
                    onFailure: (parseError) =>
                      appendReactTraceEntry(
                        new ReactTraceOptions<I, O, Tools>({
                          executionId: id,
                          moduleName: options.moduleName,
                          signature: options.signature,
                          traceInput,
                          outputSchema: options.outputSchema,
                          output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                          parseError: Option.some(parseError.message),
                          prompt,
                          response,
                          usage,
                          startedAt,
                          completedAt
                        })
                      ).pipe(
                        Effect.as(
                          new ReactLoopState({
                            iteration: Number.increment(state.iteration),
                            prompt: Prompt.concat(
                              continuation,
                              makeIterationFeedback(state.iteration, response.text, parseError)
                            ),
                            output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                            lastRawResponse: Option.some(response.text),
                            lastDiagnostics: parseError.fieldDiagnostics,
                            lastTurnWasToolCall: false
                          })
                        )
                      )
                  })
                })
            })
          })
      )

      // The terminal failure carries the same target evidence as a predictor parse
      // failure: actual path, encoded input and the agent's first native prompt.
      return yield* Option.match(finalState.output, {
        onSome: Effect.succeed,
        onNone: () =>
          Effect.all({
            predictorPath: path(options.parametersRef, options.moduleName),
            prompt: promptToTraceText(initialState.prompt)
          }).pipe(Effect.flatMap(({ predictorPath, prompt }) =>
            Effect.fail(
              new ParseOutputError({
                message: Arr.join(
                  Arr.make(
                    "ReAct module exhausted ",
                    Schema.encodeSync(Schema.FiniteFromString)(options.maxIterations),
                    " iterations without producing parseable output"
                  ),
                  ""
                ),
                moduleName: options.moduleName,
                rawOutput: finalState.lastRawResponse,
                retryCount: Option.some(options.maxIterations),
                context: { predictorPath, input: traceInput, prompt },
                fieldDiagnostics: finalState.lastDiagnostics
              })
            )
          ))
      })
    })
  )
}
