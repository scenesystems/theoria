/**
 * Lossless schema-bound JSON documents for traces and optimizer evidence.
 *
 * @since 0.4.0
 * @module
 */
import {
  Array as Arr,
  Boolean,
  Effect,
  Either,
  Equal,
  Match,
  Option,
  ParseResult,
  Predicate,
  Schema,
  SchemaAST
} from "effect"

const Json = Schema.parseJson()
const parseJson = Schema.decodeUnknownEither(Json)
const encodeJson = Schema.encode(Json)
const decodeJson = Schema.decode(Json)

const equivalenceAnnotation = SchemaAST.getAnnotation<unknown>(SchemaAST.EquivalenceAnnotationId)
const hasDefaultSemantics = (ast: SchemaAST.AST): boolean =>
  Boolean.every(Arr.make(
    Option.isNone(equivalenceAnnotation(ast)),
    Option.isNone(SchemaAST.getParseOptionsAnnotation(ast)),
    Option.isNone(SchemaAST.getDecodingFallbackAnnotation(ast))
  ))

const isStringRecord = Match.type<SchemaAST.AST>().pipe(
  Match.when(SchemaAST.isTypeLiteral, (ast) =>
    Boolean.every(Arr.make(
      Arr.isNonEmptyReadonlyArray(ast.propertySignatures),
      Arr.isEmptyReadonlyArray(ast.indexSignatures),
      hasDefaultSemantics(ast),
      Arr.every(ast.propertySignatures, (property) =>
        Boolean.every(Arr.make(
          Boolean.not(property.isOptional),
          Predicate.isString(property.name),
          Boolean.not(Equal.equals(property.name, "__proto__")),
          SchemaAST.isStringKeyword(property.type),
          hasDefaultSemantics(property.type)
        )))
    ))),
  Match.orElse(() => false)
)

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
 * its value. Closed records of required strings with ordinary parsing and
 * equality are JSON-lossless after schema encoding; other schemas check the
 * JSON round trip with encoded-schema equivalence. Domain transformations
 * are not decoded during this check.
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
  return Boolean.match(isStringRecord(schema.ast), {
    // Inspect the original schema, not a projection that could hide transforms.
    // Encoding admits a fresh closed record of primitive strings before JSON.
    onTrue: () => (value: A): Effect.Effect<Payload, ParseResult.ParseError, R> =>
      Effect.suspend(() =>
        ParseResult.map(
          ParseResult.flatMap(encodeDomain(value), encodeJson),
          (text) => Payload.make(text, { disableValidation: true })
        )
      ),
    onFalse: () => {
      const wireSchema = Schema.encodedSchema(schema)
      const encodeWire = Schema.encode(wireSchema)
      const decodeWire = Schema.decodeUnknown(wireSchema)
      const equivalence = Either.try(() => Schema.equivalence(wireSchema))
      return (value: A): Effect.Effect<Payload, ParseResult.ParseError, R> =>
        Effect.suspend(() =>
          ParseResult.flatMap(
            encodeDomain(value),
            (encoded) =>
              ParseResult.flatMap(ParseResult.flatMap(encodeWire(encoded), encodeJson), (text) =>
                ParseResult.flatMap(ParseResult.flatMap(decodeJson(text), decodeWire), (restored) => {
                  const compared = Either.mapLeft(
                    Either.flatMap(equivalence, (compare) => Either.try(() => compare(encoded, restored))),
                    () =>
                      new ParseResult.ParseError({
                        issue: new ParseResult.Type(
                          wireSchema.ast,
                          encoded,
                          "Encoded schema equivalence is unavailable"
                        )
                      })
                  )
                  return Either.flatMap(compared, (equivalent) =>
                    Boolean.match(equivalent, {
                      // decodeJson already established Payload's fixed JSON-document refinement.
                      onTrue: () => Either.right(Payload.make(text, { disableValidation: true })),
                      onFalse: () =>
                        Either.left(
                          new ParseResult.ParseError({
                            issue: new ParseResult.Type(
                              wireSchema.ast,
                              encoded,
                              "JSON encoding did not preserve encoded schema equivalence"
                            )
                          })
                        )
                    }))
                }))
          )
        )
    }
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
