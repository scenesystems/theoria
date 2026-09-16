/**
 * ReAct runtime orchestration.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import * as Prompt from "@effect/ai/Prompt"
import type * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import type { Record } from "effect"
import { Array as Arr, Boolean, Clock, Data, Effect, Either, Number, Option, Ref, Schema } from "effect"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import { type ParseFieldDiagnostic, ParseOutputError } from "../../Errors/module.js"
import { callLmTextResponse } from "../../internal/lm.js"
import { parseTextOutput } from "../../internal/parse/decode.js"
import { buildPrompt } from "../../internal/prompt/render.js"
import type { Signature } from "../../Signature/model.js"
import { RegisteredSignature, registerRuntime, RuntimeRegistrationOptions } from "../discovery/index.js"
import type { Module } from "../model.js"
import { PayloadOptions, tracePayloadFromEncoded } from "../predict/trace.js"
import {
  appendReactTraceEntry,
  makeIterationFeedback,
  makeToolObservationFeedback,
  ReactLoopState,
  ReactTraceOptions
} from "./step.js"

/** @internal */
export class ReactRuntimeOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record.ReadonlyRecord<string, Tool.Any>
> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly inputSchema: Schema.Struct<I>
  readonly outputSchema: Schema.Struct<O>
  readonly paramsRef: Ref.Ref<ModuleParams>
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
  Tool.Requirements<Tools[keyof Tools]>
>["forward"] => {
  return Effect.fn(options.moduleName)((input) =>
    Effect.gen(function*() {
      yield* registerRuntime(
        new RuntimeRegistrationOptions({
          moduleName: options.moduleName,
          params: options.paramsRef,
          signature: new RegisteredSignature({
            description: options.signature.description,
            instructions: options.signature.instructions
          }),
          subModuleIds: Arr.empty()
        })
      )

      const params = yield* Ref.get(options.paramsRef)
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
        prompt: yield* buildPrompt(options.signature, params, input),
        output: Option.none(),
        lastRawResponse: Option.none(),
        lastDiagnostics: Arr.empty(),
        lastTurnWasToolCall: false
      })

      const finalState = yield* Effect.iterate(initialState, {
        while: (state) =>
          Boolean.and(Number.lessThan(state.iteration, options.maxIterations), Option.isNone(state.output)),
        body: (state) =>
          Effect.gen(function*() {
            const prompt = state.prompt
            const startedAt = yield* Clock.currentTimeMillis
            const [response, usage] = yield* callLmTextResponse(
              prompt,
              Boolean.match(state.lastTurnWasToolCall, {
                onTrue: () => Option.none(),
                onFalse: () => Option.some(options.toolkit)
              })
            )
            const completedAt = yield* Clock.currentTimeMillis
            const continuation = Prompt.merge(prompt, Prompt.fromResponseParts(response.content))

            return yield* Effect.if(Arr.isNonEmptyReadonlyArray(response.toolCalls), {
              onTrue: () =>
                appendReactTraceEntry(
                  new ReactTraceOptions<I, O, Tools>({
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
                      prompt: Prompt.merge(continuation, makeToolObservationFeedback(state.iteration)),
                      output: Option.none<Schema.Schema.Type<Schema.Struct<O>>>(),
                      lastRawResponse: Option.some(response.text),
                      lastDiagnostics: Arr.empty<ParseFieldDiagnostic>(),
                      lastTurnWasToolCall: true
                    })
                  )
                ),
              onFalse: () =>
                Effect.gen(function*() {
                  const parsed = yield* Effect.either(
                    parseTextOutput(options.moduleName, options.outputSchema, response.text)
                  )

                  return yield* Either.match(parsed, {
                    onRight: (output) =>
                      appendReactTraceEntry(
                        new ReactTraceOptions<I, O, Tools>({
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
                    onLeft: (parseError) =>
                      appendReactTraceEntry(
                        new ReactTraceOptions<I, O, Tools>({
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
                            prompt: Prompt.merge(
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
      })

      return yield* Option.match(finalState.output, {
        onSome: (output) => Effect.succeed(output),
        onNone: () =>
          Effect.fail(
            new ParseOutputError({
              message: Arr.join(
                Arr.make(
                  "ReAct module exhausted ",
                  Schema.encodeSync(Schema.NumberFromString)(options.maxIterations),
                  " iterations without producing parseable output"
                ),
                ""
              ),
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
