/**
 * Marker extraction and diagnostics for text-output parsing.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Boolean, Function, Number, Option, Record, Schema, String } from "effect"
import { ParseFieldDiagnostic, type ParseOutputError } from "../../DspError.js"
import { fieldMarkerRegex, type FieldNames, renderFieldMarker } from "../prompt/protocol.js"

const markerMatches = (raw: string) => Arr.fromIterable(String.matchAll(fieldMarkerRegex)(raw))

const markerField = (match: RegExpMatchArray): Option.Option<string> => Option.map(Arr.get(match, 1), String.trim)

/**
 * Scans raw LLM text output for `[[ ## fieldName ## ]]` markers and returns
 * a record mapping each field name to the text content between its marker
 * and the next marker (or end of string).
 *
 * @since 0.1.0
 * @category utils
 * @internal
 */
export const extractMarkedRecord = (raw: string): Record.ReadonlyRecord<string, string> => {
  const matches = markerMatches(raw)

  return Arr.reduce(matches, Record.empty<string, string>(), (acc, match, index) => {
    const marker = Option.all({
      field: markerField(match),
      index: Option.fromNullable(match.index),
      text: Arr.head(match)
    })

    return Option.match(marker, {
      onNone: () => acc,
      onSome: (marker) => {
        const contentStart = Number.sum(marker.index, String.length(marker.text))
        const contentEnd = Arr.get(matches, Number.increment(index)).pipe(
          Option.flatMap((next) => Option.fromNullable(next.index)),
          Option.getOrElse(() => String.length(raw))
        )

        return Record.set(acc, marker.field, String.trim(String.slice(contentStart, contentEnd)(raw)))
      }
    })
  })
}

const duplicateFieldDiagnostics = (raw: string): ParseOutputError["fieldDiagnostics"] => {
  const fields = Arr.filterMap(markerMatches(raw), markerField)
  const counts = Record.map(Arr.groupBy(fields, Function.identity), Arr.length)

  return Arr.filterMap(Record.toEntries(counts), ([field, count]) =>
    Boolean.match(Number.greaterThan(count, 1), {
      onFalse: () => Option.none<ParseFieldDiagnostic>(),
      onTrue: () =>
        Option.some(
          new ParseFieldDiagnostic({
            field,
            issue: "duplicate-field",
            message: Arr.join(
              Arr.make(
                "Marker ",
                renderFieldMarker(field),
                " appeared ",
                Schema.encodeSync(Schema.NumberFromString)(count),
                " times"
              ),
              ""
            )
          })
        )
    }))
}

const missingFieldDiagnostics = (
  expectedFields: typeof FieldNames.Type,
  actualFields: typeof FieldNames.Type
): ParseOutputError["fieldDiagnostics"] =>
  Arr.map(
    Arr.difference(expectedFields, actualFields),
    (fieldName) =>
      new ParseFieldDiagnostic({
        field: fieldName,
        issue: "missing-field",
        message: Arr.join(Arr.make("Expected marker ", renderFieldMarker(fieldName), " was not found"), "")
      })
  )

const unexpectedFieldDiagnostics = (
  expectedFields: typeof FieldNames.Type,
  actualFields: typeof FieldNames.Type
): ParseOutputError["fieldDiagnostics"] =>
  Arr.map(
    Arr.difference(actualFields, expectedFields),
    (fieldName) =>
      new ParseFieldDiagnostic({
        field: fieldName,
        issue: "unexpected-field",
        message: Arr.join(
          Arr.make("Marker ", renderFieldMarker(fieldName), " is not declared in the output schema"),
          ""
        )
      })
  )

/**
 * Compares expected output field names against the markers actually present
 * in the raw LLM text and produces diagnostics for missing fields, duplicate
 * markers, and unexpected fields not declared in the output schema.
 *
 * These diagnostics drive the feedback message in parse-retry loops.
 *
 * @since 0.1.0
 * @category utils
 * @internal
 */
export const markerDiagnostics = (
  expectedFields: typeof FieldNames.Type,
  raw: string
): ParseOutputError["fieldDiagnostics"] => {
  const actualFields = Record.keys(extractMarkedRecord(raw))

  return Arr.appendAll(
    duplicateFieldDiagnostics(raw),
    Arr.appendAll(
      missingFieldDiagnostics(expectedFields, actualFields),
      unexpectedFieldDiagnostics(expectedFields, actualFields)
    )
  )
}
