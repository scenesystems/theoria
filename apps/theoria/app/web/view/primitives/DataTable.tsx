import { Match } from "effect"
import * as Arr from "effect/Array"

import { Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type DataTableDensity = "standard" | "compact"

type DataTableLayout = "default" | "trace"

type TableColumnKind = "index" | "measure" | "detail" | "wide"

const tableMinWidthClassName = ({
  kinds,
  layout
}: {
  readonly kinds: ReadonlyArray<TableColumnKind>
  readonly layout: DataTableLayout
}): string => {
  const wideColumns = kinds.filter((kind) => kind === "wide").length
  return layout === "trace" || wideColumns >= 2 ? "min-w-[72rem]" : "min-w-[58rem]"
}

const colClassNameFor = (kind: TableColumnKind): string =>
  Match.value(kind).pipe(
    Match.when("index", () => "w-[4.5rem]"),
    Match.when("measure", () => "w-[10rem]"),
    Match.when("detail", () => "w-[16rem]"),
    Match.orElse(() => "w-[24rem]")
  )

const cellClassName = ({
  alignRight,
  density
}: {
  readonly alignRight: boolean
  readonly density: DataTableDensity
}): string =>
  `${density === "compact" ? "px-3 py-2" : "px-3 py-2.5 sm:px-4 sm:py-3"}
  ${alignRight ? "text-right" : "text-left"}`

const bodyRowClassName = ({
  density,
  rowIndex
}: {
  readonly density: DataTableDensity
  readonly rowIndex: number
}): string =>
  `border-b border-stage-200/40 transition-colors hover:bg-stage-100/50 last:border-b-0 ${
    rowIndex % 2 === 0 ? "bg-stage-0" : "bg-stage-50/30"
  } ${density === "compact" ? "align-top" : ""}`

const isNumeric = (value: string): boolean => {
  const trimmed = value.trim()
  return trimmed.length > 0 && !Number.isNaN(Number(trimmed))
}

const inferAlignment = (column: number, rows: ReadonlyArray<ReadonlyArray<string>>): "left" | "right" => {
  const numericCount = rows.filter((row) => row[column] !== undefined && isNumeric(row[column])).length
  return numericCount > rows.length / 2 ? "right" : "left"
}

const averageCellLength = (column: number, rows: ReadonlyArray<ReadonlyArray<string>>): number => {
  const values = rows.flatMap((row) => row[column] === undefined ? [] : [row[column]])
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value.length, 0) / values.length
}

const headerKind = (header: string): TableColumnKind | null => {
  const normalized = header.trim().toLowerCase()

  if (/^(#|id|rank|row|step|index)$/.test(normalized)) {
    return "index"
  }

  if (
    /(observation|rationale|description|summary|proof|detail|note|scenario|context|transcript|corpus)/.test(normalized)
  ) {
    return "wide"
  }

  if (
    /(population|intervention|objective|method|label|title|baseline|improved|result|status|variant)/.test(normalized)
  ) {
    return "detail"
  }

  return null
}

const inferColumnKind = ({
  column,
  header,
  rows
}: {
  readonly column: number
  readonly header: string
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
}): TableColumnKind => {
  const headerGuess = headerKind(header)

  if (headerGuess !== null) {
    return headerGuess
  }

  if (inferAlignment(column, rows) === "right") {
    return "measure"
  }

  const averageLength = averageCellLength(column, rows)
  return averageLength >= 72 ? "wide" : averageLength >= 28 ? "detail" : "measure"
}

const inferLayout = ({
  columns,
  kinds
}: {
  readonly columns: ReadonlyArray<string>
  readonly kinds: ReadonlyArray<TableColumnKind>
}): DataTableLayout => columns.length >= 5 || kinds.some((kind) => kind === "wide") ? "trace" : "default"

export const DataTable = ({
  density = "standard",
  label,
  layout = "default",
  columns,
  rows,
  summaryVisible = true
}: {
  readonly density?: DataTableDensity
  readonly label: string
  readonly layout?: DataTableLayout
  readonly columns: ReadonlyArray<string>
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
  readonly summaryVisible?: boolean
}) => {
  const columnKinds = Arr.map(columns, (column, i) => inferColumnKind({ column: i, header: column, rows }))
  const alignments = Arr.map(columns, (_, i) => inferAlignment(i, rows))
  const resolvedLayout = inferLayout({ columns, kinds: columnKinds }) === "trace" ? "trace" : layout
  const resolvedDensity = resolvedLayout === "trace" || columns.length >= 5 ? "compact" : density
  const metaLabel = `${rows.length} rows · ${columns.length} columns`

  return (
    <Stack className={summaryVisible ? "gap-3" : "gap-0"}>
      {summaryVisible
        ? (
          <Stack className="gap-0.5 px-1">
            <SemanticText as="p" className="max-w-none text-ink-700" role="row-label" text={label} variant="expanded" />
            <SemanticText as="p" className="text-ink-600" role="code-meta" text={metaLabel} variant="expanded" />
          </Stack>
        )
        : null}

      <Layer className="overflow-x-auto border-t border-b border-stage-200/72 bg-stage-0/36">
        <table
          className={`${tableMinWidthClassName({ kinds: columnKinds, layout: resolvedLayout })} w-full border-collapse`}
        >
          <colgroup>
            {Arr.map(columnKinds, (kind, index) => <col className={colClassNameFor(kind)} key={`${kind}-${index}`} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-stage-200/80 bg-stage-50/60">
              {Arr.map(
                columns,
                (col, i) => (
                  <th
                    key={col}
                    className={cellClassName({ alignRight: alignments[i] === "right", density: resolvedDensity })}
                  >
                    <SemanticText
                      as="p"
                      className="text-ink-700"
                      role="row-label"
                      text={col}
                      variant="expanded"
                    />
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {Arr.map(rows, (row, rowIndex) => (
              <tr
                key={rowIndex}
                className={bodyRowClassName({ density: resolvedDensity, rowIndex })}
              >
                {Arr.map(row, (cell, colIndex) => (
                  <td
                    key={colIndex}
                    className={`${
                      cellClassName({ alignRight: alignments[colIndex] === "right", density: resolvedDensity })
                    } align-top`}
                  >
                    <SemanticText
                      as="p"
                      className={`${alignments[colIndex] === "right" ? "tabular-nums " : ""}text-ink-800`}
                      role={alignments[colIndex] === "right" ? "code-meta" : "row-value"}
                      text={cell}
                      variant="expanded"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Layer>
    </Stack>
  )
}
