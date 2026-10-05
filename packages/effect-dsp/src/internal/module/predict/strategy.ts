/**
 * Predict-forward strategy dispatch (structured vs text).
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Array as Arr, Data, Effect, Match, Option } from "effect"
import { resolveStrategy } from "../../../ModuleParameters.js"
import { Attempt } from "../../../Trace.js"
import { callLmResponse, callLmTextResponse } from "../../lm.js"
import { parseTextWithRetry, ParseTextWithRetryOptions } from "../../parse/retry.js"
import { buildPrompt } from "../../prompt/render.js"
import { promptToTraceText } from "../../prompt/trace.js"
import { appendAttempt } from "../../trace/attempts.js"
import { ForwardExecution, type ForwardOptions } from "./model.js"
import { PayloadOptions, tracePayloadFromEncoded } from "./trace.js"

class PreparedText<P, R, U> extends Data.Class<{
  readonly prompt: P
  readonly response: R
  readonly usage: U
}> {}

const runStructuredForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: ForwardOptions<I, O>) =>
  Effect.gen(function*() {
    const prompt = yield* buildPrompt(options.signature, options.parameters, options.input)
    const [response, usage] = yield* callLmResponse(prompt, options.outputSchema)
    yield* appendAttempt(
      new Attempt({
        execution: options.executionId,
        rawResponse: response.text,
        parseError: Option.none(),
        unparsed: Option.none(),
        usage
      })
    )
    const traceOutput = yield* tracePayloadFromEncoded(
      new PayloadOptions({
        moduleName: options.moduleName,
        carrier: "output",
        schema: options.outputSchema,
        value: response.value
      })
    )

    return new ForwardExecution({
      output: response.value,
      traceOutput,
      promptText: yield* promptToTraceText(prompt),
      rawResponse: response.text,
      usage
    })
  })

const runTextForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: ForwardOptions<I, O>) =>
  Effect.gen(function*() {
    const parsePolicy = options.policy.parse

    const [output, { prompt, response, usage }] = yield* parseTextWithRetry(
      new ParseTextWithRetryOptions({
        moduleName: options.moduleName,
        schema: options.outputSchema,
        maxRetries: parsePolicy.maxRetries,
        retrySchedule: parsePolicy.retrySchedule,
        feedbackTemplate: parsePolicy.feedbackTemplate,
        readText: (feedback) =>
          Effect.gen(function*() {
            const prompt = yield* buildPrompt(options.signature, options.parameters, options.input, feedback)
            const [response, usage] = yield* callLmTextResponse(prompt)

            return new PreparedText({ prompt, response, usage })
          }),
        text: (prepared) => prepared.response.text,
        observe: (prepared, error) =>
          appendAttempt(
            new Attempt({
              execution: options.executionId,
              rawResponse: prepared.response.text,
              parseError: Option.map(error, (error) => error.message),
              unparsed: Option.map(error, (error) => ({
                response: prepared.response.text,
                parseError: Option.some(error.message),
                toolCallCount: 0,
                toolResultCount: 0
              })),
              usage: prepared.usage
            })
          )
      })
    )

    const traceOutput = yield* tracePayloadFromEncoded(
      new PayloadOptions({
        moduleName: options.moduleName,
        carrier: "output",
        schema: options.outputSchema,
        value: output
      })
    )

    return new ForwardExecution({
      output,
      traceOutput,
      promptText: yield* promptToTraceText(prompt),
      rawResponse: response.text,
      usage
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
>(options: ForwardOptions<I, O>) =>
  Match.value(resolveStrategy(options.parameters.outputStrategy, Arr.length(options.parameters.demos))).pipe(
    Match.when("structured", () => runStructuredForward(options)),
    Match.when("text", () => runTextForward(options)),
    Match.exhaustive
  )
