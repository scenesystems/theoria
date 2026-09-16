/**
 * Schema-bound JSON documents for heterogeneous trace and optimizer payloads.
 *
 * @since 0.4.0
 * @module
 */
import { Effect, Either, ParseResult, Schema } from "effect"

const parseJson = Schema.decodeUnknownEither(Schema.parseJson())

/**
 * A syntactically valid JSON document. Its domain type belongs to the schema
 * supplied to {@link encodePayload} and {@link decodePayload}, not a parallel
 * recursive value model. Validation admits untrusted persisted text only;
 * decoding domain data always requires its actual schema.
 *
 * @since 0.4.0
 * @category schemas
 */
export const Payload = Schema.String.pipe(
  Schema.filter((text) => Either.isRight(parseJson(text)), { description: "a valid JSON document" }),
  Schema.brand("effect-dsp/Payload")
)

/**
 * Serialized data whose domain type is recovered through its schema.
 * @since 0.4.0
 * @category type-level
 */
export type Payload = typeof Payload.Type

/**
 * Encodes a value with its owning schema, then checks the JSON round trip with
 * the encoded schema's equivalence. Domain transformations are not decoded
 * during this check. Lossy data (such as Infinity becoming null), unavailable
 * equivalence and failed equivalence checks remain typed parse failures.
 *
 * The wire schema must describe JSON data with a suitable equivalence. Opaque
 * declarations and Unknown/Object do not provide general JSON structural
 * equality; use explicit encoded schemas and native equivalence annotations
 * for those contracts. This does not derive a JSON model for arbitrary objects.
 *
 * @since 0.4.0
 * @category encoding
 */
export const encodePayload = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A
): Effect.Effect<Payload, ParseResult.ParseError, R> =>
  Effect.gen(function*() {
    const encoded = yield* Schema.encode(schema)(value)
    const wireSchema = Schema.encodedSchema(schema)
    const codec = Schema.parseJson(wireSchema)
    const text = yield* Schema.encode(codec)(encoded)
    const restored = yield* Schema.decode(codec)(text)
    const equivalent = yield* Effect.try({
      try: () => Schema.equivalence(wireSchema)(encoded, restored),
      catch: () =>
        new ParseResult.ParseError({
          issue: new ParseResult.Type(wireSchema.ast, encoded, "Encoded schema equivalence is unavailable")
        })
    })
    return yield* Schema.decode(Payload)(text).pipe(Effect.filterOrFail(
      () => equivalent,
      () =>
        new ParseResult.ParseError({
          issue: new ParseResult.Type(
            wireSchema.ast,
            encoded,
            "JSON encoding did not preserve encoded schema equivalence"
          )
        })
    ))
  })

/**
 * Restores a document through its domain schema, preserving decoded types,
 * expected parse failures, and schema service requirements. Supply
 * `Schema.encodedSchema(schema)` when inspecting the wire representation.
 *
 * @since 0.4.0
 * @category decoding
 */
export const decodePayload = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  document: Payload
): Effect.Effect<A, ParseResult.ParseError, R> => Schema.decode(Schema.parseJson(schema))(document)
