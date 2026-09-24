/**
 * Lossless schema-bound JSON documents for traces and optimizer evidence.
 *
 * @since 0.4.0
 * @module
 */
import { Effect, Either, ParseResult, Schema, type SchemaAST } from "effect"

const Json = Schema.parseJson()
const parseJson = Schema.decodeUnknownEither(Json)
const encodeJson = Schema.encode(Json)
const decodeJson = Schema.decode(Json)

/**
 * A syntactically valid JSON document. Its domain type belongs to the schema
 * supplied to {@link encode} and {@link decode}, not a parallel
 * recursive value model. Validation admits untrusted persisted text only;
 * decoding domain data always requires its actual schema.
 *
 * @since 0.4.0
 * @category schemas
 */
export const Payload = Schema.String.pipe(
  Schema.filter((text) => Either.isRight(parseJson(text)), { description: "a valid JSON document" }),
  Schema.brand("@scenesystems/effect-dsp/Payload")
)

/**
 * Serialized data whose domain type is recovered through its schema.
 * @since 0.4.0
 * @category type-level
 */
export type Payload = typeof Payload.Type

/**
 * Prepares a reusable schema-bound payload encoder. Every invocation encodes
 * its value and checks the JSON round trip with the encoded schema's
 * equivalence. Domain transformations are not decoded during this check.
 * Schema services and asynchronous transformations remain invocation-local.
 * Lossy data, unavailable equivalence and failed comparisons remain checked
 * parse failures; only schema preparation is reused, never encoded values.
 *
 * The wire schema must describe JSON data with a suitable equivalence. Opaque
 * declarations and Unknown/Object do not provide general JSON structural
 * equality; use explicit encoded schemas and native equivalence annotations
 * for those contracts. This does not derive a JSON model for arbitrary objects.
 *
 * @since 0.4.0
 * @category encoding
 */
export const makeEncoder = <A, I, R>(schema: Schema.Schema<A, I, R>) => {
  const encodeDomain = Schema.encode(schema)
  const wireSchema = Schema.encodedSchema(schema)
  const encodeWire = Schema.encode(wireSchema)
  const decodeWire = Schema.decodeUnknown(wireSchema)
  const equivalence = Either.try(() => Schema.equivalence(wireSchema))
  return (value: A): Effect.Effect<Payload, ParseResult.ParseError, R> =>
    Effect.gen(function*() {
      const encoded = yield* encodeDomain(value)
      const text = yield* encodeWire(encoded).pipe(Effect.flatMap(encodeJson))
      const restored = yield* decodeJson(text).pipe(Effect.flatMap(decodeWire))
      const equivalent = yield* equivalence.pipe(
        Effect.flatMap((compare) => Effect.try(() => compare(encoded, restored))),
        Effect.mapError(() =>
          new ParseResult.ParseError({
            issue: new ParseResult.Type(wireSchema.ast, encoded, "Encoded schema equivalence is unavailable")
          })
        )
      )
      return yield* Effect.if(equivalent, {
        // decodeJson already established Payload's fixed JSON-document refinement.
        onTrue: () => Effect.succeed(Payload.make(text, { disableValidation: true })),
        onFalse: () =>
          Effect.fail(
            new ParseResult.ParseError({
              issue: new ParseResult.Type(
                wireSchema.ast,
                encoded,
                "JSON encoding did not preserve encoded schema equivalence"
              )
            })
          )
      })
    })
}

/**
 * Encodes a value as a lossless schema-bound JSON document. Use
 * {@link makeEncoder} when repeatedly encoding through the same schema.
 *
 * @since 0.4.0
 * @category encoding
 */
export const encode = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A
): Effect.Effect<Payload, ParseResult.ParseError, R> => Effect.suspend(() => makeEncoder(schema)(value))

/**
 * Restores a document through its domain schema, preserving decoded types,
 * expected parse failures, and schema service requirements. Supply
 * `Schema.encodedSchema(schema)` when inspecting the wire representation.
 * Native parse options control policies such as rejecting excess fields.
 *
 * @since 0.4.0
 * @category decoding
 */
export const decode = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  document: Payload,
  options?: SchemaAST.ParseOptions
): Effect.Effect<A, ParseResult.ParseError, R> =>
  decodeJson(document, options).pipe(Effect.flatMap(Schema.decodeUnknown(schema, options)))
