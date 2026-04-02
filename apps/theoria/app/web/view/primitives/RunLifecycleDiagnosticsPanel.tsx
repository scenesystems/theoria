import type { RunRuntimeTelemetrySection } from "../../atoms/surface.js"

import { DataTable } from "./DataTable.js"

import { Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const factGridClassName = (count: number): string =>
  count <= 2
    ? "grid border-t border-stage-200/72"
    : "grid border-t border-stage-200/72 md:grid-cols-2"

const sectionShellClassName = (index: number): string =>
  index === 0 ? "gap-3" : "gap-3 border-t border-stage-200/72 pt-5"

const factCellClassName = ({
  index,
  total
}: {
  readonly index: number
  readonly total: number
}): string =>
  [
    "min-h-[5rem] gap-1.5 border-b border-stage-200/72 py-3",
    total > 1 && index % 2 === 0 ? "md:pr-5 md:border-r" : "",
    total > 1 && index % 2 === 1 ? "md:pl-5" : ""
  ].join(" ")

const factsSection = (rows: RunRuntimeTelemetrySection["rows"]) => (
  <Layer as="dl" className={factGridClassName(rows.length)}>
    {rows.map((row, index) => (
      <Stack className={factCellClassName({ index, total: rows.length })} key={row.label}>
        <SemanticText as="dt" className="text-ink-600" role="row-label" text={row.label} variant="expanded" />
        <SemanticText as="dd" className="max-w-none text-ink-900" role="status" text={row.value} variant="expanded" />
      </Stack>
    ))}
  </Layer>
)

export const RunLifecycleDiagnosticsPanel = ({
  sections
}: {
  readonly sections: ReadonlyArray<RunRuntimeTelemetrySection>
}) =>
  sections.length === 0
    ? null
    : (
      <Stack className="gap-5">
        {sections.map((section, index) => (
          <Stack className={sectionShellClassName(index)} key={section.title}>
            <Stack className="gap-1 px-1">
              <SemanticText
                as="h3"
                className="text-ink-900"
                role="section-title"
                text={section.title}
                variant="expanded"
              />
              <SemanticText
                as="p"
                className="text-ink-700"
                role="status"
                text={section.description}
                variant="expanded"
              />
            </Stack>

            {section.kind === "trace"
              ? (
                <DataTable
                  columns={["Signal", "Value"]}
                  density="compact"
                  label={section.title}
                  layout="trace"
                  rows={section.rows.map((row) => [row.label, row.value])}
                />
              )
              : factsSection(section.rows)}
          </Stack>
        ))}
      </Stack>
    )
