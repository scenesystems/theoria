/**
 * Predict trace projection helpers.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Effect } from "effect"
import type { FieldRecord as FieldRecordType } from "../../contracts/FieldValue.js"
import { encodeAndProjectFieldRecord } from "../../contracts/PayloadProjection.js"
import { UsageSample } from "../../contracts/Usage.js"
import { TraceError } from "../../Errors/trace.js"
import type { Signature } from "../../Signature/model.js"
import { appendExecution, Entry, noScore } from "../../Trace/index.js"
import type { ForwardExecution } from "./model.js"

type TraceCarrier = "input" | "output"

const traceCarrierError = (
  moduleName: string,
  carrier: TraceCarrier
): TraceError =>
  new TraceError({
    message: `Trace ${carrier} payload failed schema projection`,
    moduleName
  })

/**
 * Encode a typed payload through its schema and project it into `FieldRecord`.
 *
 * @since 0.1.0
 * @internal
 */
export const tracePayloadFromEncoded = <A, I, R>(options: {
  readonly moduleName: string
  readonly carrier: TraceCarrier
  readonly schema: Schema.Schema<A, I, R>
  readonly value: A
}): Effect.Effect<
  FieldRecordType,
  TraceError,
  R
> =>
  encodeAndProjectFieldRecord(
    options.schema,
    options.value,
    () => traceCarrierError(options.moduleName, options.carrier)
  )

/**
 * Append a canonical trace entry for a completed predict-forward invocation.
 *
 * @since 0.1.0
 * @internal
 */
export const appendTraceEntry = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly inputSchema: Schema.Struct<I>
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly execution: ForwardExecution<Schema.Schema.Type<Schema.Struct<O>>>
  readonly startedAt: number
  readonly completedAt: number
  readonly cached: boolean
}) =>
  Effect.gen(function*() {
    const traceInput = yield* tracePayloadFromEncoded({
      moduleName: options.moduleName,
      carrier: "input",
      schema: options.inputSchema,
      value: options.input
    })

    const entry = new Entry({
      moduleName: options.moduleName,
      signatureDescription: options.signature.description,
      input: traceInput,
      output: options.execution.traceOutput,
      prompt: options.execution.promptText,
      rawResponse: options.execution.rawResponse,
      inputTokens: options.execution.inputTokens,
      outputTokens: options.execution.outputTokens,
      durationMs: options.completedAt - options.startedAt,
      score: noScore,
      timestamp: options.completedAt
    })

    const usage = new UsageSample({
      inputTokens: options.execution.inputTokens,
      outputTokens: options.execution.outputTokens,
      cached: options.cached
    })

    yield* appendExecution({
      entry,
      usage
    })
  })
