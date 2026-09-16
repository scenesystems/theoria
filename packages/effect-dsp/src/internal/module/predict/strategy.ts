/**
 * Predict-forward strategy dispatch (structured vs text).
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Array as Arr, Data, Effect, Match } from "effect"
import { resolveStrategy } from "../../../ModuleParameters.js"
import { callLmResponse, callLmTextResponse } from "../../lm.js"
import { parseTextWithRetry, ParseTextWithRetryOptions } from "../../parse/retry.js"
import { buildPrompt } from "../../prompt/render.js"
import { promptToTraceText } from "../../prompt/trace.js"
import { ForwardExecution, type ForwardOptions } from "./model.js"
import { PayloadOptions, tracePayloadFromEncoded } from "./trace.js"

const runStructuredForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: ForwardOptions<I, O>) =>
  Effect.gen(function*() {
    const prompt = yield* buildPrompt(options.signature, options.params, options.input)
    const [response, usage] = yield* callLmResponse(prompt, options.outputSchema)
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
            const prompt = yield* buildPrompt(options.signature, options.params, options.input, feedback)
            const [response, usage] = yield* callLmTextResponse(prompt)

            return Data.struct({ prompt, response, usage })
          }),
        text: (prepared) => prepared.response.text
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
  Match.value(resolveStrategy(options.params.outputStrategy, Arr.length(options.params.demos))).pipe(
    Match.when("structured", () => runStructuredForward(options)),
    Match.when("text", () => runTextForward(options)),
    Match.exhaustive
  )
