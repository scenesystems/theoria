/**
 * Defines few-shot wire values and codecs compiled from module signatures.
 *
 * @since 0.4.0
 * @module
 */
import { Data, Effect, ParseResult, Schema } from "effect"
import { decode, encode, Payload } from "./Payload.js"

/**
 * A schema-encoded input and expected output used as a few-shot example.
 * @since 0.4.0
 * @category models
 */
export class Demonstration extends Schema.Class<Demonstration>("@scenesystems/effect-dsp/Demonstration")({
  input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  output: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}

/**
 * Lossless input and output documents produced by a destination codec.
 * @since 0.4.0
 * @category schemas
 */
export const Documents = Schema.Tuple(Payload, Payload)
/**
 * Lossless input and output documents produced by a destination codec.
 * @since 0.4.0
 * @category models
 */
export type Documents = typeof Documents.Type

/**
 * Executable demonstration operations compiled from a destination signature.
 * Validation and equivalence use the encoded schemas and never rerun domain
 * transformations.
 * @since 0.4.0
 * @category models
 */
export class Codec extends Data.Class<{
  readonly decode: (value: unknown) => Effect.Effect<Demonstration, ParseResult.ParseError>
  readonly encode: (value: Demonstration) => Effect.Effect<Documents, ParseResult.ParseError>
  readonly decodeDocuments: (
    input: Payload,
    output: Payload
  ) => Effect.Effect<Demonstration, ParseResult.ParseError>
  readonly equivalent: (
    left: Demonstration,
    right: Demonstration
  ) => Effect.Effect<boolean, ParseResult.ParseError>
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
 * Compiles a destination-specific codec from input and output schemas.
 * @since 0.4.0
 * @category constructors
 */
export const codec = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  inputSchema: Schema.Struct<I>,
  outputSchema: Schema.Struct<O>
): Codec => {
  const input = Schema.encodedBoundSchema(inputSchema)
  const output = Schema.encodedBoundSchema(outputSchema)
  const wire = Schema.Struct({ input, output })
  return new Codec({
    decode: (value) =>
      Schema.decodeUnknown(wire)(value, { onExcessProperty: "error" }).pipe(
        Effect.map((demonstration) => new Demonstration(demonstration))
      ),
    encode: (demonstration) =>
      Schema.decodeUnknown(wire)(demonstration, { onExcessProperty: "error" }).pipe(
        Effect.flatMap((validated) => Effect.zip(encode(input, validated.input), encode(output, validated.output)))
      ),
    decodeDocuments: (inputDocument, outputDocument) =>
      Effect.gen(function*() {
        const inputValue = yield* decode(input, inputDocument, { onExcessProperty: "error" })
        const outputValue = yield* decode(output, outputDocument, { onExcessProperty: "error" })
        return new Demonstration({ input: inputValue, output: outputValue })
      }),
    equivalent: (left, right) =>
      Effect.if(equivalentWire(input, left.input, right.input), {
        onTrue: () => equivalentWire(output, left.output, right.output),
        onFalse: () => Effect.succeed(false)
      })
  })
}
