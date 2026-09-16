/**
 * Destination-owned validation, trace replay, and equality for demonstrations.
 *
 * @since 0.4.0
 * @module
 */
import { Data, Effect, ParseResult, Schema } from "effect"
import { Demo } from "../Example/index.js"
import { decodePayload, encodePayload, Payload } from "./Payload.js"

/**
 * Serialized input and output documents for one destination-owned demonstration.
 *
 * @since 0.4.0
 * @category schemas
 */
export const DemoDocuments = Schema.Tuple(Payload, Payload)

/**
 * Serialized input and output documents for one destination-owned demonstration.
 *
 * @since 0.4.0
 * @category type-level
 */
export type DemoDocuments = typeof DemoDocuments.Type

/**
 * Operations compiled from one signature's encoded input/output schemas.
 * The generic schemas stay captured by native decoders and equivalences rather
 * than being widened to a heterogeneous unknown-valued schema. Wire operations
 * do not run domain transformations or require their services.
 *
 * @since 0.4.0
 * @category models
 */
export class DemoContract extends Data.Class<{
  /** Validates untrusted demonstration fields against the destination. */
  readonly decode: (value: unknown) => Effect.Effect<Demo, ParseResult.ParseError>
  /** Validates and losslessly serializes destination-encoded demonstration fields. */
  readonly toTrace: (demo: Demo) => Effect.Effect<DemoDocuments, ParseResult.ParseError>
  /** Restores destination-specific encoded values from trace documents. */
  readonly fromTrace: (input: Payload, output: Payload) => Effect.Effect<Demo, ParseResult.ParseError>
  /** Compares encoded inputs first; unequal inputs skip output comparison. */
  readonly equivalent: (left: Demo, right: Demo) => Effect.Effect<boolean, ParseResult.ParseError>
}> {}

const equivalentWire = <A, I>(schema: Schema.Schema<A, I>, left: unknown, right: unknown) =>
  Effect.gen(function*() {
    const first = yield* Schema.decodeUnknown(schema)(left, { onExcessProperty: "error" })
    const second = yield* Schema.decodeUnknown(schema)(right, { onExcessProperty: "error" })
    return yield* Effect.try({
      try: () => Schema.equivalence(schema)(first, second),
      catch: () =>
        new ParseResult.ParseError({
          issue: new ParseResult.Type(schema.ast, left, "Demonstration schema equivalence is unavailable")
        })
    })
  })

/**
 * Compiles native wire operations while the actual signature types are known.
 * Encoded-side bounds are retained; decoded-side transformations are not run.
 *
 * @since 0.4.0
 * @category constructors
 */
export const makeDemoContract = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  inputSchema: Schema.Struct<I>,
  outputSchema: Schema.Struct<O>
): DemoContract => {
  const input = Schema.encodedBoundSchema(inputSchema)
  const output = Schema.encodedBoundSchema(outputSchema)
  const wire = Schema.Struct({ input, output })
  return new DemoContract({
    decode: (value) =>
      Schema.decodeUnknown(wire)(value, { onExcessProperty: "error" }).pipe(
        Effect.map((demo) => new Demo({ input: demo.input, output: demo.output }))
      ),
    toTrace: (demo) =>
      Schema.decodeUnknown(wire)(demo, { onExcessProperty: "error" }).pipe(
        Effect.flatMap((validated) =>
          Effect.zip(
            encodePayload(input, validated.input),
            encodePayload(output, validated.output)
          )
        )
      ),
    fromTrace: (inputDocument, outputDocument) =>
      Effect.gen(function*() {
        const inputValue = yield* decodePayload(input, inputDocument, { onExcessProperty: "error" })
        const outputValue = yield* decodePayload(output, outputDocument, { onExcessProperty: "error" })
        return new Demo({ input: inputValue, output: outputValue })
      }),
    equivalent: (left, right) =>
      Effect.if(equivalentWire(input, left.input, right.input), {
        onTrue: () => equivalentWire(output, left.output, right.output),
        onFalse: () => Effect.succeed(false)
      })
  })
}
