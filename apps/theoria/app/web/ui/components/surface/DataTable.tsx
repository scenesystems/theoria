import type { ReactNode } from "react"

import {
  dataTableBodyRowClassName,
  dataTableCellClassName,
  dataTableClassName,
  type DataTableColumnAlign,
  dataTableColumnClassName,
  type DataTableColumnWidth,
  type DataTableDensity,
  dataTableEmptyCellClassName,
  dataTableHeaderCellClassName,
  dataTableHeadRowClassName,
  type DataTableLayout,
  dataTableMinWidthClassName
} from "../../recipes/data-display.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

export type DataTableColumn = {
  readonly align?: DataTableColumnAlign
  readonly key: string
  readonly label: ReactNode
  readonly width?: DataTableColumnWidth
}

export type DataTableRow = {
  readonly cells: ReadonlyArray<ReactNode>
  readonly key?: string
}

type DataTableProps = {
  readonly className?: string
  readonly columns: ReadonlyArray<DataTableColumn>
  readonly density?: DataTableDensity
  readonly emptyLabel?: ReactNode
  readonly label?: ReactNode
  readonly layout?: DataTableLayout
  readonly meta?: ReactNode
  readonly rows: ReadonlyArray<DataTableRow>
}

const dataTableColumnAlign = (column: DataTableColumn): DataTableColumnAlign => column.align ?? "start"

const dataTableColumnWidth = (column: DataTableColumn): DataTableColumnWidth => column.width ?? "detail"

const resolvedTableLayout = ({
  columns,
  layout
}: {
  readonly columns: ReadonlyArray<DataTableColumn>
  readonly layout: DataTableLayout | undefined
}): DataTableLayout =>
  layout ??
    (columns.length >= 5 || columns.some((column) => dataTableColumnWidth(column) === "wide") ? "trace" : "default")

const dataTableLabelContent = (label: ReactNode): ReactNode =>
  typeof label === "string" || typeof label === "number"
    ? <SemanticText role="label" tone="muted">{label}</SemanticText>
    : label

const dataTableMetaContent = (meta: ReactNode): ReactNode =>
  typeof meta === "string" || typeof meta === "number"
    ? <SemanticText role="body-sm" tone="muted">{meta}</SemanticText>
    : meta

const dataTableHeaderContent = (label: ReactNode): ReactNode =>
  typeof label === "string" || typeof label === "number"
    ? <SemanticText as="span" role="label" tone="inherit">{label}</SemanticText>
    : label

const dataTableCellContent = ({
  align,
  value
}: {
  readonly align: DataTableColumnAlign
  readonly value: ReactNode
}): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? (
      <SemanticText
        as="span"
        className={align === "end" ? "tabular-nums text-inherit" : "text-inherit"}
        role="body"
        tone="inherit"
      >
        {value}
      </SemanticText>
    )
    : value

export const DataTable = ({
  className,
  columns,
  density = "standard",
  emptyLabel = "No rows available.",
  label,
  layout,
  meta,
  rows
}: DataTableProps) => {
  const resolvedLayout = resolvedTableLayout({ columns, layout })
  const wideColumnCount = columns.filter((column) => dataTableColumnWidth(column) === "wide").length
  const emptyColumnSpan = columns.length === 0 ? 1 : columns.length

  return (
    <Stack gap="sm">
      {label === undefined && meta === undefined
        ? null
        : (
          <Stack className="px-1" gap="xs">
            {label === undefined ? null : dataTableLabelContent(label)}
            {meta === undefined ? null : dataTableMetaContent(meta)}
          </Stack>
        )}
      <Box
        className={dataTableClassName({ layout: resolvedLayout, ...(className === undefined ? {} : { className }) })}
      >
        <table
          className={[
            dataTableMinWidthClassName({ columnCount: columns.length, layout: resolvedLayout, wideColumnCount }),
            "w-full border-collapse"
          ].join(" ")}
        >
          <colgroup>
            {columns.map((column) => (
              <col className={dataTableColumnClassName(dataTableColumnWidth(column))} key={column.key} />
            ))}
          </colgroup>
          {columns.length === 0
            ? null
            : (
              <thead>
                <tr className={dataTableHeadRowClassName({ density })}>
                  {columns.map((column) => {
                    const align = dataTableColumnAlign(column)

                    return (
                      <th className={dataTableHeaderCellClassName({ align, density })} key={column.key}>
                        {dataTableHeaderContent(column.label)}
                      </th>
                    )
                  })}
                </tr>
              </thead>
            )}
          <tbody>
            {rows.length === 0
              ? (
                <tr className={dataTableBodyRowClassName({ density })}>
                  <td className={dataTableEmptyCellClassName({ density })} colSpan={emptyColumnSpan}>
                    {dataTableCellContent({ align: "start", value: emptyLabel })}
                  </td>
                </tr>
              )
              : rows.map((row, rowIndex) => (
                <tr className={dataTableBodyRowClassName({ density })} key={row.key ?? String(rowIndex)}>
                  {columns.map((column, columnIndex) => {
                    const align = dataTableColumnAlign(column)

                    return (
                      <td className={dataTableCellClassName({ align, density })} key={column.key}>
                        {dataTableCellContent({ align, value: row.cells[columnIndex] ?? "" })}
                      </td>
                    )
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </Box>
    </Stack>
  )
}
