/**
 * Schema decoding and typed ParseOutputError mapping.
 *
 * @since 0.0.0
 * @internal
 */
import { Array as Arr, Effect, Match, Option, Predicate, Record, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"
import { ParseFieldDiagnostic, ParseOutputError } from "../../Errors/module.js"
import { extractMarkedRecord, markerDiagnostics } from "./protocol.js"

const pathSegmentToField = (segment: PropertyKey): string =>
  Match.value(segment).pipe(
    Match.when(Predicate.isString, (value) => value),
    Match.when(Predicate.isNumber, (value) => String(value)),
    Match.orElse(() => "[root]")
  )

const fieldFromPath = (path: ReadonlyArray<PropertyKey>): string =>
  Option.match(Arr.head(path), {
    onNone: () => "[root]",
    onSome: pathSegmentToField
  })

const schemaDiagnostics = (issue: ParseResult.ParseIssue): ReadonlyArray<ParseFieldDiagnostic> =>
  Arr.map(
    ParseResult.ArrayFormatter.formatIssueSync(issue),
    (diagnostic) =>
      new ParseFieldDiagnostic({
        field: fieldFromPath(diagnostic.path),
        issue: "decode-error",
        message: diagnostic.message
      })
  )

const parseOutputError = (options: {
  readonly moduleName: string
  readonly rawOutput: Option.Option<string>
  readonly message: string
  readonly retryCount: Option.Option<number>
  readonly diagnostics: ReadonlyArray<ParseFieldDiagnostic>
}): ParseOutputError =>
  new ParseOutputError({
    message: options.message,
    moduleName: options.moduleName,
    rawOutput: options.rawOutput,
    retryCount: options.retryCount,
    fieldDiagnostics: options.diagnostics
  })

const decodeStruct = <O extends Schema.Struct.Fields>(options: {
  readonly moduleName: string
  readonly schema: Schema.Struct<O>
  readonly value: unknown
  readonly rawOutput: Option.Option<string>
  readonly retryCount: Option.Option<number>
  readonly message: string
  readonly protocolDiagnostics: ReadonlyArray<ParseFieldDiagnostic>
}): Effect.Effect<Schema.Schema.Type<Schema.Struct<O>>, ParseOutputError, Schema.Schema.Context<Schema.Struct<O>>> =>
  Schema.decodeUnknown(options.schema)(options.value).pipe(
    Effect.mapError((error) =>
      parseOutputError({
        moduleName: options.moduleName,
        rawOutput: options.rawOutput,
        message: options.message,
        retryCount: options.retryCount,
        diagnostics: Arr.appendAll(options.protocolDiagnostics, schemaDiagnostics(error.issue))
      })
    )
  )

/**
 * Decodes a value produced by `generateObject` against the module's output
 * schema, mapping any schema validation failures into a `ParseOutputError`
 * with per-field diagnostics.
 *
 * @since 0.0.0
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
    protocolDiagnostics: []
  })

/**
 * Extracts marker-delimited fields from raw LLM text, then decodes the
 * resulting record against the module's output schema.
 *
 * Merges marker-level diagnostics (missing, duplicate, unexpected fields)
 * with schema-level decode errors into a single `ParseOutputError`.
 *
 * @since 0.0.0
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
