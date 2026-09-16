/**
 * ReAct iteration feedback and trace helpers.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import type * as Prompt from "@effect/ai/Prompt"
import type * as Response from "@effect/ai/Response"
import type * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import type { Record } from "effect"
import { Array as Arr, Data, Effect, Number, Option, Schema, String } from "effect"
import type { FieldRecord } from "../../contracts/FieldValue.js"
import { projectFieldRecord } from "../../contracts/PayloadProjection.js"
import type { ParseOutputError } from "../../Errors/module.js"
import { TraceError } from "../../Errors/trace.js"
import { promptToTraceText } from "../../internal/prompt/trace.js"
import type { Signature } from "../../Signature/model.js"
import { append, Entry, noScore } from "../../Trace/index.js"
import { defaultParseFeedbackTemplate } from "../predict/policy.js"
import { PayloadOptions, tracePayloadFromEncoded } from "../predict/trace.js"

/**
 * ReAct loop state model.
 *
 * @since 0.1.0
 * @category models
 */
export class ReactLoopState<A> extends Data.Class<{
  readonly iteration: number
  readonly prompt: Prompt.Prompt
  readonly output: Option.Option<A>
  readonly lastRawResponse: Option.Option<string>
  readonly lastDiagnostics: ParseOutputError["fieldDiagnostics"]
  readonly lastTurnWasToolCall: boolean
}> {}

/**
 * Render tool-observation feedback for a successful tool-call iteration.
 *
 * @since 0.1.0
 * @category combinators
 */
export const makeToolObservationFeedback = (iteration: number): string =>
  Arr.join(
    Arr.make(
      Arr.join(
        Arr.make(
          "Iteration ",
          Schema.encodeSync(Schema.NumberFromString)(Number.increment(iteration)),
          " executed tool calls."
        ),
        ""
      ),
      "Tool observations: the preceding native tool messages contain the results.",
      "Continue reasoning from these tool observations and return the final answer using the required output field markers."
    ),
    "\n\n"
  )

/**
 * Render parse-feedback for the next ReAct iteration.
 *
 * @since 0.1.0
 * @category combinators
 */
export const makeIterationFeedback = (
  iteration: number,
  responseText: string,
  parseError: ParseOutputError
): string =>
  Arr.join(
    Arr.make(
      Arr.join(
        Arr.make(
          "Iteration ",
          Schema.encodeSync(Schema.NumberFromString)(Number.increment(iteration)),
          " did not produce parseable output."
        ),
        ""
      ),
      String.concat("Model response:\n", responseText),
      String.concat("Parse feedback:\n", defaultParseFeedbackTemplate(parseError)),
      "Respond again using only the required output field markers."
    ),
    "\n\n"
  )

const traceProjectionError = (moduleName: string): TraceError =>
  new TraceError({
    message: "Trace output payload failed schema projection",
    moduleName
  })

export class ReactTraceOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record.ReadonlyRecord<string, Tool.Any>
> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly traceInput: FieldRecord
  readonly outputSchema: Schema.Struct<O>
  readonly output: Option.Option<Schema.Schema.Type<Schema.Struct<O>>>
  readonly parseError: Option.Option<string>
  readonly prompt: Prompt.RawInput
  readonly response:
    | LanguageModel.GenerateTextResponse<Tools>
    | LanguageModel.GenerateTextResponse<Toolkit.Tools<typeof Toolkit.empty>>
  readonly usage: Response.Usage
  readonly startedAt: number
  readonly completedAt: number
}> {}

/**
 * Append one ReAct iteration's trace; call accounting is owned by LM execution.
 *
 * @since 0.1.0
 * @category combinators
 */
export const appendReactTraceEntry = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record.ReadonlyRecord<string, Tool.Any>
>(
  options: ReactTraceOptions<I, O, Tools>
): Effect.Effect<void, TraceError, Schema.Schema.Context<Schema.Struct<O>>> =>
  Effect.gen(function*() {
    const traceOutput = yield* Option.match(options.output, {
      onSome: (output) =>
        tracePayloadFromEncoded(
          new PayloadOptions({
            moduleName: options.moduleName,
            carrier: "output",
            schema: options.outputSchema,
            value: output
          })
        ),
      onNone: () =>
        projectFieldRecord(
          {
            response: options.response.text,
            parseError: Option.getOrElse(options.parseError, () => "none"),
            toolCallCount: Arr.length(options.response.toolCalls),
            toolResultCount: Arr.length(options.response.toolResults)
          },
          () => traceProjectionError(options.moduleName)
        )
    })

    const entry = new Entry({
      moduleName: options.moduleName,
      signatureDescription: options.signature.description,
      input: options.traceInput,
      output: traceOutput,
      prompt: yield* promptToTraceText(options.prompt),
      rawResponse: options.response.text,
      usage: options.usage,
      durationMs: Number.subtract(options.completedAt, options.startedAt),
      score: noScore,
      timestamp: options.completedAt
    })

    yield* append(entry)
  })
