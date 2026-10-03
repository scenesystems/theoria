/**
 * Schema decoding and typed ParseOutputError mapping.
 *
 * @since 0.1.0
 * @internal
 */
import type { SchemaAST } from "effect"
import { Array as Arr, Data, Effect, Match, Option, Predicate, Record, Schema, SchemaIssue, Tuple } from "effect"
import { ParseFieldDiagnostic, ParseOutputError } from "../../DspError.js"
import { encodedFieldSchema, encodedFieldsToInfoArray } from "../signature/fields.js"
import { extractMarkedRecord, markerDiagnostics } from "./protocol.js"

const pathSegmentToField = (segment: unknown): string =>
  Match.value(segment).pipe(
    Match.when(Predicate.isString, (value) => value),
    Match.when(Predicate.isNumber, Schema.encodeSync(Schema.FiniteFromString)),
    Match.orElse(() => "[root]")
  )

const schemaDiagnostics = (issue: SchemaIssue.Issue): ParseOutputError["fieldDiagnostics"] =>
  Arr.map(
    SchemaIssue.makeFormatterStandardSchemaV1()(issue).issues,
    (diagnostic) =>
      new ParseFieldDiagnostic({
        field: Option.match(Option.fromNullishOr(diagnostic.path).pipe(Option.flatMap(Arr.head)), {
          onNone: () => "[root]",
          onSome: (segment) => pathSegmentToField(Predicate.isObject(segment) ? segment.key : segment)
        }),
        issue: "decode-error",
        message: diagnostic.message
      })
  )

class DecodeOptions<A, R> extends Data.Class<{
  readonly moduleName: string
  readonly decode: Effect.Effect<A, Schema.SchemaError, R>
  readonly rawOutput: Option.Option<string>
  readonly retryCount: Option.Option<number>
  readonly message: string
  readonly protocolDiagnostics: ParseOutputError["fieldDiagnostics"]
}> {}

const decodeOutput = <A, R>(options: DecodeOptions<A, R>): Effect.Effect<A, ParseOutputError, R> =>
  options.decode.pipe(
    Effect.mapError((error) =>
      new ParseOutputError({
        moduleName: options.moduleName,
        rawOutput: options.rawOutput,
        message: options.message,
        retryCount: options.retryCount,
        fieldDiagnostics: Arr.appendAll(options.protocolDiagnostics, schemaDiagnostics(error.issue))
      })
    )
  )

const decodeTextFields = <A, R>(
  schema: Schema.Codec<A, Record.ReadonlyRecord<string, unknown>, R, unknown>,
  rawOutput: string,
  options?: SchemaAST.ParseOptions
): Effect.Effect<A, Schema.SchemaError, R> =>
  Effect.gen(function*() {
    // Project the whole Struct so optional/defaulted/renamed properties retain
    // their encoded contract without running property or domain transformations.
    const encoded = Schema.toEncoded(schema)
    const record = extractMarkedRecord(rawOutput)
    const entries = yield* Effect.forEach(Record.toEntries(record), ([name, text]) =>
      Effect.gen(function*() {
        const value = yield* Option.match(encodedFieldSchema(encoded, name), {
          onNone: () => Effect.succeed(text),
          onSome: (field) => {
            // Raw strings win even in ambiguous unions. JSON is only a wire fallback
            // for non-strings, never a second attempt at a failed domain transformation.
            const wire = Schema.Union([
              Schema.String.pipe(Schema.decodeTo(field)),
              Schema.fromJsonString(field.check(Schema.makeFilter(Predicate.not(Predicate.isString))))
            ])
            return Schema.decodeEffect(wire)(text)
          }
        })
        return Tuple.make(name, value)
      }).pipe(
        Effect.mapError((error) => new Schema.SchemaError(new SchemaIssue.Pointer([name], error.issue)))
      ))

    // Missing fields remain absent. The original Struct alone applies defaults,
    // Option/property transformations, domain decoding and service requirements.
    return yield* Schema.decodeEffect(schema)(Record.fromEntries(entries), options)
  })

/**
 * Decodes a value produced by `generateObject` against the module's output
 * schema, mapping any schema validation failures into a `ParseOutputError`
 * with per-field diagnostics.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const parseStructuredOutput = <O extends Schema.Struct.Fields>(
  moduleName: string,
  schema: Schema.Struct<O>,
  value: unknown
): Effect.Effect<Schema.Schema.Type<Schema.Struct<O>>, ParseOutputError, Schema.Struct<O>["DecodingServices"]> =>
  decodeOutput(
    new DecodeOptions({
      moduleName,
      decode: Schema.decodeUnknownEffect(schema)(value),
      rawOutput: Option.some("[structured-output]"),
      retryCount: Option.none<number>(),
      message: "Unable to decode structured output against module schema",
      protocolDiagnostics: Arr.empty()
    })
  )

/**
 * Extracts marker-delimited fields from raw LLM text, then decodes the
 * resulting record against the module's output schema.
 *
 * Merges marker-level diagnostics (missing, duplicate, unexpected fields)
 * with schema-level decode errors into a single `ParseOutputError`.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const parseTextOutput = <A, R>(
  moduleName: string,
  schema: Schema.Codec<A, Record.ReadonlyRecord<string, unknown>, R, unknown>,
  rawOutput: string,
  options?: SchemaAST.ParseOptions
): Effect.Effect<A, ParseOutputError, R> => {
  const expectedFields = Arr.map(encodedFieldsToInfoArray(schema), (field) => field.name)

  return decodeOutput(
    new DecodeOptions({
      moduleName,
      decode: decodeTextFields(schema, rawOutput, options),
      rawOutput: Option.some(rawOutput),
      retryCount: Option.none<number>(),
      message: "Unable to decode text output against module schema",
      protocolDiagnostics: markerDiagnostics(expectedFields, rawOutput)
    })
  )
}
