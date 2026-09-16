/**
 * Schema decoding and typed ParseOutputError mapping.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Data, Effect, Match, Option, Predicate, Record, Schema, Tuple } from "effect"
import * as ParseResult from "effect/ParseResult"
import { ParseFieldDiagnostic, ParseOutputError } from "../../DspError.js"
import { encodedFieldsToInfoArray } from "../signature/fields.js"
import { extractMarkedRecord, markerDiagnostics } from "./protocol.js"

const pathSegmentToField = (segment: PropertyKey): string =>
  Match.value(segment).pipe(
    Match.when(Predicate.isString, (value) => value),
    Match.when(Predicate.isNumber, Schema.encodeSync(Schema.NumberFromString)),
    Match.when(Predicate.isSymbol, () => "[root]"),
    Match.exhaustive
  )

const fieldFromPath = (path: ParseResult.ArrayFormatterIssue["path"]): string =>
  Option.match(Arr.head(path), {
    onNone: () => "[root]",
    onSome: pathSegmentToField
  })

const schemaDiagnostics = (issue: ParseResult.ParseIssue): ParseOutputError["fieldDiagnostics"] =>
  Arr.map(
    ParseResult.ArrayFormatter.formatIssueSync(issue),
    (diagnostic) =>
      new ParseFieldDiagnostic({
        field: fieldFromPath(diagnostic.path),
        issue: "decode-error",
        message: diagnostic.message
      })
  )

class DecodeOptions<A, R> extends Data.Class<{
  readonly moduleName: string
  readonly decode: Effect.Effect<A, ParseResult.ParseError, R>
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

const decodeTextFields = <O extends Schema.Struct.Fields>(schema: Schema.Struct<O>, rawOutput: string) =>
  Effect.gen(function*() {
    // Project the whole Struct so optional/defaulted/renamed properties retain
    // their encoded contract without running property or domain transformations.
    const encoded = Schema.encodedBoundSchema(schema)
    const decodeKey = Schema.decodeUnknownOption(Schema.keyof(encoded))
    const record = extractMarkedRecord(rawOutput)
    const entries = yield* Effect.forEach(Record.toEntries(record), ([name, text]) =>
      Effect.gen(function*() {
        const value = yield* Option.match(decodeKey(name), {
          onNone: () => Effect.succeed(text),
          onSome: (key) => {
            const field = Schema.typeSchema(Schema.pluck(encoded, key))
            // Raw strings win even in ambiguous unions. JSON is only a wire fallback
            // for non-strings, never a second attempt at a failed domain transformation.
            const wire = Schema.Union(
              Schema.compose(Schema.String, field, { strict: false }),
              Schema.parseJson(field.pipe(Schema.filter(Predicate.not(Predicate.isString))))
            )
            return Schema.decodeUnknown(wire)(text)
          }
        })
        return Tuple.make(name, value)
      }).pipe(
        Effect.mapError((error) =>
          new ParseResult.ParseError({ issue: new ParseResult.Pointer(name, record, error.issue) })
        )
      ))

    // Missing fields remain absent. The original Struct alone applies defaults,
    // Option/property transformations, domain decoding and service requirements.
    return yield* Schema.decodeUnknown(schema)(Record.fromEntries(entries))
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
): Effect.Effect<Schema.Schema.Type<Schema.Struct<O>>, ParseOutputError, Schema.Schema.Context<Schema.Struct<O>>> =>
  decodeOutput({
    moduleName,
    decode: Schema.decodeUnknown(schema)(value),
    rawOutput: Option.some("[structured-output]"),
    retryCount: Option.none<number>(),
    message: "Unable to decode structured output against module schema",
    protocolDiagnostics: Arr.empty()
  })

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
export const parseTextOutput = <O extends Schema.Struct.Fields>(
  moduleName: string,
  schema: Schema.Struct<O>,
  rawOutput: string
): Effect.Effect<Schema.Schema.Type<Schema.Struct<O>>, ParseOutputError, Schema.Schema.Context<Schema.Struct<O>>> => {
  const expectedFields = Arr.map(encodedFieldsToInfoArray(schema.fields), (field) => field.name)

  return decodeOutput({
    moduleName,
    decode: decodeTextFields(schema, rawOutput),
    rawOutput: Option.some(rawOutput),
    retryCount: Option.none<number>(),
    message: "Unable to decode text output against module schema",
    protocolDiagnostics: markerDiagnostics(expectedFields, rawOutput)
  })
}
