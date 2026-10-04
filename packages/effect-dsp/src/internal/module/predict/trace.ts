/**
 * Predict trace projection helpers.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Data, Effect, Number, Schema } from "effect"
import { TraceError } from "../../../DspError.js"
import { encode, type Payload } from "../../../Payload.js"
import type { Signature } from "../../../Signature.js"
import { append, Entry, noScore } from "../../../Trace.js"
import type { ForwardExecution } from "./model.js"

const TraceCarrier = Schema.Literals(["input", "output"])

const traceCarrierError = (
  moduleName: string,
  carrier: typeof TraceCarrier.Type
): TraceError =>
  new TraceError({
    message: Arr.join(Arr.make("Trace ", carrier, " payload failed schema projection"), ""),
    moduleName
  })

/** @internal */
export class PayloadOptions<A, I, DR, ER> extends Data.Class<{
  readonly moduleName: string
  readonly carrier: typeof TraceCarrier.Type
  readonly schema: Schema.Codec<A, I, DR, ER>
  readonly value: A
}> {}

/**
 * Encode a typed payload through its schema into a lossless JSON document.
 *
 * @since 0.1.0
 * @internal
 */
export const tracePayloadFromEncoded = <A, I, DR, ER>(options: PayloadOptions<A, I, DR, ER>): Effect.Effect<
  Payload,
  TraceError,
  ER
> =>
  encode(options.schema, options.value).pipe(
    Effect.mapError(() => traceCarrierError(options.moduleName, options.carrier))
  )

/** @internal */
export class TraceOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly inputSchema: Signature<I, O>["inputSchema"]
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly execution: ForwardExecution<Schema.Schema.Type<Schema.Struct<O>>>
  readonly startedAt: number
  readonly completedAt: number
}> {}

/**
 * Append a canonical trace entry for a completed predict-forward invocation.
 *
 * @since 0.1.0
 * @internal
 */
export const appendTraceEntry = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: TraceOptions<I, O>) =>
  Effect.gen(function*() {
    const traceInput = yield* tracePayloadFromEncoded(
      new PayloadOptions({
        moduleName: options.moduleName,
        carrier: "input",
        schema: options.inputSchema,
        value: options.input
      })
    )

    const entry = new Entry({
      moduleName: options.moduleName,
      signatureDescription: options.signature.description,
      input: traceInput,
      output: options.execution.traceOutput,
      outcome: "completed",
      prompt: options.execution.promptText,
      rawResponse: options.execution.rawResponse,
      usage: options.execution.usage,
      durationMs: Number.subtract(options.completedAt, options.startedAt),
      score: noScore,
      timestamp: options.completedAt
    })

    yield* append(entry)
  })
