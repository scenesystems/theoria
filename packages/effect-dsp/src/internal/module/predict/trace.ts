/**
 * Predict trace projection helpers.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Data, Effect, Number, Schema } from "effect"
import { TraceError } from "../../../DspError.js"
import { makeEncoder, type Payload } from "../../../Payload.js"
import type { Signature } from "../../../Signature.js"
import { append, Entry, noScore } from "../../../Trace.js"
import type { ForwardExecution } from "./model.js"

const TraceCarrier = Schema.Literal("input", "output")

const traceCarrierError = (
  moduleName: string,
  carrier: typeof TraceCarrier.Type
): TraceError =>
  new TraceError({
    message: Arr.join(Arr.make("Trace ", carrier, " payload failed schema projection"), ""),
    moduleName
  })

/** @internal */
export class PayloadOptions<A, I, R> extends Data.Class<{
  readonly moduleName: string
  readonly carrier: typeof TraceCarrier.Type
  readonly schema: Schema.Schema<A, I, R>
  readonly value: A
}> {}

/**
 * Prepares a schema-owned trace encoder without caching invocation values.
 * @since 0.4.0
 * @internal
 */
export const makeTracePayloadEncoder = <A, I, R>(
  moduleName: string,
  carrier: typeof TraceCarrier.Type,
  schema: Schema.Schema<A, I, R>
) => {
  const encode = makeEncoder(schema)
  return (value: A): Effect.Effect<Payload, TraceError, R> =>
    encode(value).pipe(Effect.mapError(() => traceCarrierError(moduleName, carrier)))
}

/**
 * Encode a typed payload through its schema into a lossless JSON document.
 *
 * @since 0.1.0
 * @internal
 */
export const tracePayloadFromEncoded = <A, I, R>(options: PayloadOptions<A, I, R>): Effect.Effect<
  Payload,
  TraceError,
  R
> => Effect.suspend(() => makeTracePayloadEncoder(options.moduleName, options.carrier, options.schema)(options.value))

/** @internal */
export class TraceOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly encodeInput: (
    value: Schema.Schema.Type<Schema.Struct<I>>
  ) => Effect.Effect<Payload, TraceError, Schema.Schema.Context<Schema.Struct<I>>>
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
    const traceInput = yield* options.encodeInput(options.input)

    // This closed predictor path already admits metadata at registration,
    // payloads through their lossless encoders, and selected usage in Call.
    // The remaining fields are rendered strings, Clock numbers and fixed defaults.
    // Keep public Entry construction and untrusted persisted decoding validated.
    const entry = new Entry({
      moduleName: options.moduleName,
      signatureDescription: options.signature.description,
      input: traceInput,
      output: options.execution.traceOutput,
      prompt: options.execution.promptText,
      rawResponse: options.execution.rawResponse,
      usage: options.execution.usage,
      durationMs: Number.subtract(options.completedAt, options.startedAt),
      score: noScore,
      timestamp: options.completedAt
    }, true)

    yield* append(entry)
  })
