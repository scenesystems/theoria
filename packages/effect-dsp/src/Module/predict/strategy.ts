/**
 * Predict-forward strategy dispatch (structured vs text).
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import type { Schema } from "effect"
import { Effect, Option, Ref, Schedule } from "effect"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import { resolveStrategy } from "../../contracts/OutputStrategy.js"
import type { ParseOutputError } from "../../Errors/module.js"
import type { TraceError } from "../../Errors/trace.js"
import { callLmResponse, callLmTextResponse } from "../../internal/lm.js"
import { parseTextWithRetry, ParseTextWithRetryOptions } from "../../internal/parse/retry.js"
import { buildPrompt } from "../../internal/prompt/render.js"
import { promptToTraceText } from "../../internal/prompt/trace.js"
import type { Signature } from "../../Signature/model.js"
import { ForwardExecution } from "./model.js"
import type { PredictPolicy } from "./policy.js"
import { tracePayloadFromEncoded } from "./trace.js"

type StructuredOutput<O extends Schema.Struct.Fields> = Schema.Schema.Type<Schema.Struct<O>>

type ForwardStrategyEffect<O extends Schema.Struct.Fields> = Effect.Effect<
  ForwardExecution<StructuredOutput<O>>,
  AiError.AiError | ParseOutputError | TraceError,
  LanguageModel.LanguageModel | Schema.Schema.Context<Schema.Struct<O>>
>

const runStructuredForwardOnce = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly params: ModuleParams
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly outputSchema: Schema.Struct<O>
}): ForwardStrategyEffect<O> =>
  Effect.gen(function*() {
    const prompt = buildPrompt(options.signature, options.params, options.input)
    const response = yield* callLmResponse(prompt, options.outputSchema)
    const traceOutput = yield* tracePayloadFromEncoded({
      moduleName: options.moduleName,
      carrier: "output",
      schema: options.outputSchema,
      value: response.value
    })

    return new ForwardExecution({
      output: response.value,
      traceOutput,
      promptText: promptToTraceText(prompt),
      rawResponse: response.text,
      inputTokens: Option.fromNullable(response.usage.inputTokens),
      outputTokens: Option.fromNullable(response.usage.outputTokens)
    })
  })

const runStructuredForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly params: ModuleParams
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly outputSchema: Schema.Struct<O>
  readonly policy: PredictPolicy
}): ForwardStrategyEffect<O> =>
  Effect.gen(function*() {
    const retryDriver = yield* Schedule.driver(options.policy.parse.retrySchedule(options.policy.parse.maxRetries))

    const retryLoop = (): ForwardStrategyEffect<O> =>
      runStructuredForwardOnce(options).pipe(
        Effect.catchTag(
          "MalformedOutput",
          (error) =>
            retryDriver.next(error).pipe(
              Effect.matchEffect({
                onFailure: () => Effect.fail(error),
                onSuccess: () => retryLoop()
              })
            )
        )
      )

    return yield* retryLoop()
  })

const runTextForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly params: ModuleParams
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly outputSchema: Schema.Struct<O>
  readonly policy: PredictPolicy
}): ForwardStrategyEffect<O> =>
  Effect.gen(function*() {
    const parsePolicy = options.policy.parse
    const latestPromptText = yield* Ref.make("")
    const latestRawResponse = yield* Ref.make("")
    const latestInputTokens = yield* Ref.make<Option.Option<number>>(Option.none())
    const latestOutputTokens = yield* Ref.make<Option.Option<number>>(Option.none())

    const output = yield* parseTextWithRetry(
      new ParseTextWithRetryOptions({
        moduleName: options.moduleName,
        schema: options.outputSchema,
        maxRetries: parsePolicy.maxRetries,
        retrySchedule: parsePolicy.retrySchedule,
        feedbackTemplate: parsePolicy.feedbackTemplate,
        readText: (feedback: Option.Option<string>) =>
          Effect.gen(function*() {
            const prompt = buildPrompt(options.signature, options.params, options.input, feedback)
            const response = yield* callLmTextResponse(prompt)

            yield* Ref.set(latestPromptText, promptToTraceText(prompt))
            yield* Ref.set(latestRawResponse, response.text)
            yield* Ref.set(latestInputTokens, Option.fromNullable(response.usage.inputTokens))
            yield* Ref.set(latestOutputTokens, Option.fromNullable(response.usage.outputTokens))

            return response.text
          })
      })
    )

    const traceOutput = yield* tracePayloadFromEncoded({
      moduleName: options.moduleName,
      carrier: "output",
      schema: options.outputSchema,
      value: output
    })

    return new ForwardExecution({
      output,
      traceOutput,
      promptText: yield* Ref.get(latestPromptText),
      rawResponse: yield* Ref.get(latestRawResponse),
      inputTokens: yield* Ref.get(latestInputTokens),
      outputTokens: yield* Ref.get(latestOutputTokens)
    })
  })

/**
 * Resolve and execute the forward strategy for a module call.
 *
 * @since 0.1.0
 * @internal
 */
export const runForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly params: ModuleParams
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly outputSchema: Schema.Struct<O>
  readonly policy: PredictPolicy
}): ForwardStrategyEffect<O> =>
  Effect.if(
    resolveStrategy(options.params.outputStrategy, options.params.demos.length) === "structured",
    {
      onTrue: () => runStructuredForward(options),
      onFalse: () => runTextForward(options)
    }
  )
