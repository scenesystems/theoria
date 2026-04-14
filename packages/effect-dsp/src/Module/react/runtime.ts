/**
 * ReAct runtime orchestration.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import type { Schema } from "effect"
import { Array as Arr, Clock, Effect, Either, Option, Ref } from "effect"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import { type ParseFieldDiagnostic, ParseOutputError } from "../../Errors/module.js"
import { TraceError } from "../../Errors/trace.js"
import { callLmTextResponse } from "../../internal/lm.js"
import { parseTextOutput } from "../../internal/parse/decode.js"
import { buildPrompt } from "../../internal/prompt/render.js"
import type { Signature } from "../../Signature/model.js"
import { RegisteredSignature, registerRuntime } from "../discovery/index.js"
import type { Module } from "../model.js"
import { tracePayloadFromEncoded } from "../predict/trace.js"
import { appendReactTraceEntry, ReactFeedback, type ReactLoopState } from "./step.js"

/**
 * Typed ReAct runtime ownership surface.
 *
 * @since 0.1.0
 * @internal
 */
export const ReactRuntime = {
  forward: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields,
    Tools extends Record<string, Tool.Any>
  >(options: {
    readonly moduleName: string
    readonly signature: Signature<I, O>
    readonly inputSchema: Schema.Struct<I>
    readonly outputSchema: Schema.Struct<O>
    readonly paramsRef: Ref.Ref<ModuleParams>
    readonly toolkit: Toolkit.WithHandler<Tools>
    readonly maxIterations: number
  }): Module<I, O>["forward"] =>
    Effect.fn(options.moduleName)((input) =>
      Effect.gen(function*() {
        yield* registerRuntime({
          moduleName: options.moduleName,
          params: options.paramsRef,
          signature: RegisteredSignature.make({
            description: options.signature.description,
            instructions: options.signature.instructions
          }),
          subModuleIds: Arr.empty()
        })

        const params = yield* Ref.get(options.paramsRef)
        const traceInput = yield* tracePayloadFromEncoded({
          moduleName: options.moduleName,
          carrier: "input",
          schema: options.inputSchema,
          value: input
        })

        const initialState: ReactLoopState<Schema.Schema.Type<Schema.Struct<O>>> = {
          iteration: 0,
          feedbackHistory: Arr.empty(),
          output: Option.none(),
          lastRawResponse: Option.none(),
          lastDiagnostics: Arr.empty(),
          lastTurnWasToolCall: false
        }

        const finalState = yield* Effect.iterate(initialState, {
          while: (state) => state.iteration < options.maxIterations && Option.isNone(state.output),
          body: (state) =>
            Effect.gen(function*() {
              const prompt = buildPrompt(
                options.signature,
                params,
                input,
                ReactFeedback.fromHistory(state.feedbackHistory)
              )
              const startedAt = yield* Clock.currentTimeMillis
              const response = yield* callLmTextResponse(
                prompt,
                state.lastTurnWasToolCall
                  ? {}
                  : { toolkit: options.toolkit }
              ).pipe(
                Effect.mapError(() =>
                  TraceError.make({
                    message: "ReAct language-model call failed",
                    moduleName: options.moduleName
                  })
                )
              )
              const completedAt = yield* Clock.currentTimeMillis

              const isToolCallTurn = response.toolCalls.length > 0

              if (isToolCallTurn) {
                return yield* appendReactTraceEntry({
                  moduleName: options.moduleName,
                  signature: options.signature,
                  traceInput,
                  outputSchema: options.outputSchema,
                  output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                  parseError: Option.none(),
                  prompt,
                  response,
                  startedAt,
                  completedAt
                }).pipe(
                  Effect.as({
                    iteration: state.iteration + 1,
                    feedbackHistory: Arr.append(
                      state.feedbackHistory,
                      ReactFeedback.fromToolObservation({
                        iteration: state.iteration,
                        response
                      })
                    ),
                    output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                    lastRawResponse: Option.some(response.text),
                    lastDiagnostics: Arr.empty<ParseFieldDiagnostic>(),
                    lastTurnWasToolCall: true
                  })
                )
              }

              const parsed = yield* Effect.either(
                parseTextOutput(options.moduleName, options.outputSchema, response.text)
              )

              return yield* Either.match(parsed, {
                onRight: (output) =>
                  appendReactTraceEntry({
                    moduleName: options.moduleName,
                    signature: options.signature,
                    traceInput,
                    outputSchema: options.outputSchema,
                    output: Option.some(output),
                    parseError: Option.none(),
                    prompt,
                    response,
                    startedAt,
                    completedAt
                  }).pipe(
                    Effect.as({
                      iteration: state.iteration + 1,
                      feedbackHistory: state.feedbackHistory,
                      output: Option.some(output),
                      lastRawResponse: Option.some(response.text),
                      lastDiagnostics: Arr.empty<ParseFieldDiagnostic>(),
                      lastTurnWasToolCall: false
                    })
                  ),
                onLeft: (parseError) =>
                  appendReactTraceEntry({
                    moduleName: options.moduleName,
                    signature: options.signature,
                    traceInput,
                    outputSchema: options.outputSchema,
                    output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                    parseError: Option.some(parseError.message),
                    prompt,
                    response,
                    startedAt,
                    completedAt
                  }).pipe(
                    Effect.as({
                      iteration: state.iteration + 1,
                      feedbackHistory: Arr.append(
                        state.feedbackHistory,
                        ReactFeedback.fromParseError({
                          iteration: state.iteration,
                          response,
                          parseError
                        })
                      ),
                      output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                      lastRawResponse: Option.some(response.text),
                      lastDiagnostics: parseError.fieldDiagnostics,
                      lastTurnWasToolCall: false
                    })
                  )
              })
            })
        })

        return yield* Option.match(finalState.output, {
          onSome: (output) => Effect.succeed(output),
          onNone: () =>
            Effect.fail(
              ParseOutputError.make({
                message:
                  `ReAct module exhausted ${options.maxIterations} iterations without producing parseable output`,
                moduleName: options.moduleName,
                rawOutput: finalState.lastRawResponse,
                retryCount: Option.some(options.maxIterations),
                fieldDiagnostics: finalState.lastDiagnostics
              })
            )
        })
      })
    )
}
