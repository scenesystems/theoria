import * as Arr from "effect/Array"

import { surfaceMaterials } from "./designSystem.js"
import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const isNumeric = (value: string): boolean => {
  const trimmed = value.trim()
  return trimmed.length > 0 && !Number.isNaN(Number(trimmed))
}

const inferAlignment = (column: number, rows: ReadonlyArray<ReadonlyArray<string>>): "left" | "right" => {
  const numericCount = rows.filter((row) => row[column] !== undefined && isNumeric(row[column])).length
  return numericCount > rows.length / 2 ? "right" : "left"
}

export const DataTable = ({
  label,
  columns,
  rows
}: {
  readonly label: string
  readonly columns: ReadonlyArray<string>
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
}) => {
  const alignments = Arr.map(columns, (_, i) => inferAlignment(i, rows))

  return (
    <Layer className={surfaceMaterials.evidenceCardFrame}>
      <Layer className="px-4 py-2.5 border-b border-stage-200/60">
        <SemanticText as="span" className="text-ink-700" role="row-label" text={label} variant="expanded" />
      </Layer>
      <Layer className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stage-200/80 bg-stage-50/50">
              {Arr.map(
                columns,
                (col, i) => (
                  <th key={col} className={`px-3 py-2 ${alignments[i] === "right" ? "text-right" : "text-left"}`}>
                    <SemanticText
                      as="span"
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
                className={`border-b border-stage-200/40 last:border-b-0 ${
                  rowIndex % 2 === 0 ? "bg-stage-0" : "bg-stage-50/30"
                }`}
              >
                {Arr.map(row, (cell, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-3 py-1.5 ${alignments[colIndex] === "right" ? "text-right" : "text-left"}`}
                  >
                    <SemanticText
                      as="code"
                      className={`${alignments[colIndex] === "right" ? "tabular-nums " : ""}text-ink-800`}
                      role="code-meta"
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
    </Layer>
  )
}
