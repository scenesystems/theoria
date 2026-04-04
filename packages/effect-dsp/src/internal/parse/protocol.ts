/**
 * Marker extraction and diagnostics for text-output parsing.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Option, Record } from "effect"
import { ParseFieldDiagnostic } from "../../Errors/module.js"
import { FIELD_MARKER_REGEX, renderFieldMarker } from "../prompt/protocol.js"

const markerMatches = (raw: string): ReadonlyArray<RegExpMatchArray> =>
  Arr.fromIterable(raw.matchAll(FIELD_MARKER_REGEX))

const markerField = (match: RegExpMatchArray): Option.Option<string> =>
  Option.map(Option.fromNullable(match[1]), (field) => field.trim())

const markerIndex = (match: RegExpMatchArray): Option.Option<number> => Option.fromNullable(match.index)

const nextMarkerIndex = (
  matches: ReadonlyArray<RegExpMatchArray>,
  index: number
): Option.Option<number> =>
  Option.flatMap(Arr.get(matches, index + 1), (nextMatch) => Option.fromNullable(nextMatch.index))

/**
 * Scans raw LLM text output for `[[ ## fieldName ## ]]` markers and returns
 * a record mapping each field name to the text content between its marker
 * and the next marker (or end of string).
 *
 * @since 0.1.0
 * @category utils
 * @internal
 */
export const extractMarkedRecord = (raw: string): Readonly<Record<string, unknown>> => {
  const matches = markerMatches(raw)

  return Arr.reduce(matches, Record.empty<string, unknown>(), (acc, match, index) => {
    const fieldAndIndex = Option.zipWith(markerField(match), markerIndex(match), (field, indexValue) => ({
      field,
      markerIndex: indexValue
    }))

    return Option.match(fieldAndIndex, {
      onNone: () => acc,
      onSome: ({ field, markerIndex }) => {
        const markerText = match[0]
        const contentStart = markerIndex + markerText.length
        const contentEnd = Option.getOrElse(nextMarkerIndex(matches, index), () => raw.length)

        return Record.set(acc, field, raw.slice(contentStart, contentEnd).trim())
      }
    })
  })
}

const countByField = (fieldNames: ReadonlyArray<string>): Readonly<Record<string, number>> =>
  Arr.reduce(fieldNames, Record.empty<string, number>(), (counts, fieldName) => {
    const currentCount = Option.getOrElse(Record.get(counts, fieldName), () => 0)

    return Record.set(counts, fieldName, currentCount + 1)
  })

const includesField = (fieldNames: ReadonlyArray<string>, fieldName: string): boolean =>
  Option.isSome(Arr.findFirst(fieldNames, (current) => current === fieldName))

const duplicateFieldDiagnostics = (raw: string): ReadonlyArray<ParseFieldDiagnostic> => {
  const fields = Arr.filterMap(markerMatches(raw), markerField)
  const counts = countByField(fields)

  return Arr.filterMap(Record.toEntries(counts), ([field, count]) =>
    count <= 1
      ? Option.none<ParseFieldDiagnostic>()
      : Option.some(
        new ParseFieldDiagnostic({
          field,
          issue: "duplicate-field",
          message: `Marker ${renderFieldMarker(field)} appeared ${count} times`
        })
      ))
}

const missingFieldDiagnostics = (
  expectedFields: ReadonlyArray<string>,
  actualFields: ReadonlyArray<string>
): ReadonlyArray<ParseFieldDiagnostic> =>
  Arr.filterMap(expectedFields, (fieldName) =>
    includesField(actualFields, fieldName)
      ? Option.none<ParseFieldDiagnostic>()
      : Option.some(
        new ParseFieldDiagnostic({
          field: fieldName,
          issue: "missing-field",
          message: `Expected marker ${renderFieldMarker(fieldName)} was not found`
        })
      ))

const unexpectedFieldDiagnostics = (
  expectedFields: ReadonlyArray<string>,
  actualFields: ReadonlyArray<string>
): ReadonlyArray<ParseFieldDiagnostic> =>
  Arr.filterMap(actualFields, (fieldName) =>
    includesField(expectedFields, fieldName)
      ? Option.none<ParseFieldDiagnostic>()
      : Option.some(
        new ParseFieldDiagnostic({
          field: fieldName,
          issue: "unexpected-field",
          message: `Marker ${renderFieldMarker(fieldName)} is not declared in the output schema`
        })
      ))

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
  expectedFields: ReadonlyArray<string>,
  raw: string
): ReadonlyArray<ParseFieldDiagnostic> => {
  const actualFields = Record.keys(extractMarkedRecord(raw))

  return Arr.appendAll(
    duplicateFieldDiagnostics(raw),
    Arr.appendAll(
      missingFieldDiagnostics(expectedFields, actualFields),
      unexpectedFieldDiagnostics(expectedFields, actualFields)
    )
  )
}
