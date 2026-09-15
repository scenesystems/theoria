/**
 * Schema decoding and typed ParseOutputError mapping.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Data, Effect, Match, Option, Predicate, Record, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"
import { ParseFieldDiagnostic, ParseOutputError } from "../../Errors/module.js"
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

class DecodeOptions<O extends Schema.Struct.Fields> extends Data.Class<{
  readonly moduleName: string
  readonly schema: Schema.Struct<O>
  readonly value: unknown
  readonly rawOutput: Option.Option<string>
  readonly retryCount: Option.Option<number>
  readonly message: string
  readonly protocolDiagnostics: ParseOutputError["fieldDiagnostics"]
}> {}

const decodeStruct = <O extends Schema.Struct.Fields>(
  options: DecodeOptions<O>
): Effect.Effect<Schema.Schema.Type<Schema.Struct<O>>, ParseOutputError, Schema.Schema.Context<Schema.Struct<O>>> =>
  Schema.decodeUnknown(options.schema)(options.value).pipe(
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
  decodeStruct({
    moduleName,
    schema,
    value,
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
  const expectedFields = Record.keys(schema.fields)

  return decodeStruct({
    moduleName,
    schema,
    value: extractMarkedRecord(rawOutput),
    rawOutput: Option.some(rawOutput),
    retryCount: Option.none<number>(),
    message: "Unable to decode text output against module schema",
    protocolDiagnostics: markerDiagnostics(expectedFields, rawOutput)
  })
}
