/**
 * Lossless schema-bound JSON documents for traces and optimizer evidence.
 *
 * @since 0.4.0
 * @module
 */
import { Effect, Result, Schema, type SchemaAST, SchemaIssue } from "effect"

const parseJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown))

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
  Schema.check(
    Schema.makeFilter((text) => Result.isSuccess(parseJson(text)), { description: "a valid JSON document" })
  ),
  Schema.brand("@scenesystems/effect-dsp/Payload")
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
export const encode = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  value: A
): Effect.Effect<Payload, Schema.SchemaError, RE> =>
  Effect.gen(function*() {
    const encoded = yield* Schema.encodeEffect(schema)(value)
    const wireSchema = Schema.toEncoded(schema)
    const codec = Schema.fromJsonString(wireSchema)
    const text = yield* Schema.encodeEffect(codec)(encoded)
    const restored = yield* Schema.decodeEffect(codec)(text)
    const equivalent = yield* Effect.try({
      try: () => Schema.toEquivalence(wireSchema)(encoded, restored),
      catch: () =>
        new Schema.SchemaError(
          new SchemaIssue.InvalidValue({
            message: "Encoded schema equivalence is unavailable"
          }, encoded)
        )
    })
    return yield* Schema.decodeEffect(Payload)(text).pipe(Effect.filterOrFail(
      () => equivalent,
      () =>
        new Schema.SchemaError(
          new SchemaIssue.InvalidValue({
            message: "JSON encoding did not preserve encoded schema equivalence"
          }, encoded)
        )
    ))
  })

/**
 * Restores a document through its domain schema, preserving decoded types,
 * expected parse failures, and schema service requirements. Supply
 * `Schema.toEncoded(schema)` when inspecting the wire representation.
 * Native parse options control policies such as rejecting excess fields.
 *
 * @since 0.4.0
 * @category decoding
 */
export const decode = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  document: Payload,
  options?: SchemaAST.ParseOptions
): Effect.Effect<A, Schema.SchemaError, RD> => Schema.decodeEffect(Schema.fromJsonString(schema))(document, options)
