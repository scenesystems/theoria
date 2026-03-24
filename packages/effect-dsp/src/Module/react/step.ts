/**
 * ReAct iteration feedback and trace helpers.
 *
 * @since 0.0.0
 * @category internal
 * @internal
 */
import type * as Prompt from "@effect/ai/Prompt"
import type { Schema } from "effect"
import { Array as Arr, Effect, Match, Option, Predicate } from "effect"
import type { FieldRecord } from "../../contracts/FieldValue.js"
import { projectFieldRecord } from "../../contracts/PayloadProjection.js"
import { UsageSample } from "../../contracts/Usage.js"
import type { ParseFieldDiagnostic, ParseOutputError } from "../../Errors/module.js"
import { TraceError } from "../../Errors/trace.js"
import type { TextCallResult, TextToolResultSummary } from "../../internal/lm.js"
import { promptToTraceText } from "../../internal/prompt/trace.js"
import type { Signature } from "../../Signature/model.js"
import { appendExecution, Entry, noScore } from "../../Trace/index.js"
import { defaultParseFeedbackTemplate } from "../predict/policy.js"
import { tracePayloadFromEncoded } from "../predict/trace.js"

/**
 * ReAct loop state model.
 *
 * @since 0.0.0
 * @category models
 */
export type ReactLoopState<A> = Readonly<{
  readonly iteration: number
  readonly feedbackHistory: ReadonlyArray<string>
  readonly output: Option.Option<A>
  readonly lastRawResponse: Option.Option<string>
  readonly lastDiagnostics: ReadonlyArray<ParseFieldDiagnostic>
  readonly lastTurnWasToolCall: boolean
}>

const renderUnknown = (value: unknown): string =>
  Match.value(value).pipe(
    Match.when(Predicate.isString, (text) => text),
    Match.when(Predicate.isNumber, (numberValue) => String(numberValue)),
    Match.when(Predicate.isBoolean, (booleanValue) => String(booleanValue)),
    Match.when((candidate: unknown) => candidate === null, () => "null"),
    Match.orElse(() => "[non-scalar]")
  )

const renderToolResultObservation = (toolResult: TextToolResultSummary): string =>
  `- ${toolResult.name} (${toolResult.isFailure ? "failure" : "success"}): ${renderUnknown(toolResult.result)}`

const renderToolObservations = (response: TextCallResult): string =>
  Option.match(Arr.head(response.toolResults), {
    onNone: () => "Tool observations:\n- none",
    onSome: () => `Tool observations:\n${Arr.join(Arr.map(response.toolResults, renderToolResultObservation), "\n")}`
  })

/**
 * Build optional feedback payload from the accumulated iteration history.
 *
 * @since 0.0.0
 * @category combinators
 */
export const feedbackFromHistory = (history: ReadonlyArray<string>): Option.Option<string> =>
  Option.match(Arr.head(history), {
    onNone: () => Option.none<string>(),
    onSome: () => Option.some(Arr.join(history, "\n\n"))
  })

/**
 * Render tool-observation feedback for a successful tool-call iteration.
 *
 * @since 0.0.0
 * @category combinators
 */
export const makeToolObservationFeedback = (options: {
  readonly iteration: number
  readonly response: TextCallResult
}): string =>
  Arr.join(
    [
      `Iteration ${options.iteration + 1} executed tool calls.`,
      `Model response:\n${options.response.text}`,
      renderToolObservations(options.response),
      "Continue reasoning from these tool observations and return the final answer using the required output field markers."
    ],
    "\n\n"
  )

/**
 * Render parse-feedback for the next ReAct iteration.
 *
 * @since 0.0.0
 * @category combinators
 */
export const makeIterationFeedback = (options: {
  readonly iteration: number
  readonly response: TextCallResult
  readonly parseError: ParseOutputError
}): string =>
  Arr.join(
    [
      `Iteration ${options.iteration + 1} did not produce parseable output.`,
      `Model response:\n${options.response.text}`,
      renderToolObservations(options.response),
      `Parse feedback:\n${defaultParseFeedbackTemplate(options.parseError)}`,
      "Respond again using only the required output field markers."
    ],
    "\n\n"
  )

const traceProjectionError = (moduleName: string, carrier: "input" | "output"): TraceError =>
  new TraceError({
    message: `Trace ${carrier} payload failed schema projection`,
    moduleName
  })

/**
 * Append one ReAct iteration to trace and usage stores.
 *
 * @since 0.0.0
 * @category combinators
 */
export const appendReactTraceEntry = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly traceInput: FieldRecord
  readonly outputSchema: Schema.Struct<O>
  readonly output: Option.Option<Schema.Schema.Type<Schema.Struct<O>>>
  readonly parseError: Option.Option<string>
  readonly prompt: Prompt.RawInput
  readonly response: TextCallResult
  readonly startedAt: number
  readonly completedAt: number
}): Effect.Effect<void, TraceError, Schema.Schema.Context<Schema.Struct<O>>> =>
  Effect.gen(function*() {
    const traceOutput = yield* Option.match(options.output, {
      onSome: (output) =>
        tracePayloadFromEncoded({
          moduleName: options.moduleName,
          carrier: "output",
          schema: options.outputSchema,
          value: output
        }),
      onNone: () =>
        projectFieldRecord(
          {
            response: options.response.text,
            parseError: Option.getOrElse(options.parseError, () => "none"),
            toolCallCount: options.response.toolCalls.length,
            toolResultCount: options.response.toolResults.length
          },
          () => traceProjectionError(options.moduleName, "output")
        )
    })

    const entry = new Entry({
      moduleName: options.moduleName,
      signatureDescription: options.signature.description,
      input: options.traceInput,
      output: traceOutput,
      prompt: promptToTraceText(options.prompt),
      rawResponse: options.response.text,
      inputTokens: Option.fromNullable(options.response.usage.inputTokens),
      outputTokens: Option.fromNullable(options.response.usage.outputTokens),
      durationMs: options.completedAt - options.startedAt,
      score: noScore,
      timestamp: options.completedAt
    })

    const usage = new UsageSample({
      inputTokens: Option.fromNullable(options.response.usage.inputTokens),
      outputTokens: Option.fromNullable(options.response.usage.outputTokens),
      cached: false
    })

    yield* appendExecution({
      entry,
      usage
    })
  })
