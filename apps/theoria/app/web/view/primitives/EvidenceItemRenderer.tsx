import { Match } from "effect"

import type { EvidenceItem } from "../../../contracts/evidence.js"

import { formatDelta, formatNumber, formatScalar } from "../data/format.js"
import { ComparisonBar } from "./ComparisonBar.js"
import { DataTable } from "./DataTable.js"
import { surfaceMaterials } from "./designSystem.js"
import { Layer, Stack } from "./Layout.js"
import { MetricCard } from "./MetricCard.js"
import { SemanticText } from "./SemanticText.js"
import { Sparkline } from "./Sparkline.js"

export const EvidenceItemRenderer = ({ item }: { readonly item: EvidenceItem }) =>
  Match.value(item).pipe(
    Match.tag("Scalar", (i) => {
      const value = formatScalar(i.value, "", i.format)
      return <MetricCard label={i.label} unit={i.unit} value={value} />
    }),
    Match.tag("Comparison", (i) => {
      const delta = formatDelta(i.baseline, i.improved, i.direction)
      return (
        <ComparisonBar
          baselineValue={`${formatNumber(i.baseline)} ${i.unit}`}
          deltaText={delta.percentText}
          favorable={delta.favorable}
          improvedValue={`${formatNumber(i.improved)} ${i.unit}`}
          label={i.label}
        />
      )
    }),
    Match.tag("Series", (i) => {
      const min = i.values.length > 0 ? Math.min(...i.values) : 0
      const max = i.values.length > 0 ? Math.max(...i.values) : 0
      const latest = i.values.length > 0 ? i.values[i.values.length - 1]! : 0
      return (
        <Sparkline
          label={i.label}
          summaryItems={[
            { label: "Min", value: formatNumber(min) },
            { label: "Max", value: formatNumber(max) },
            { label: "Latest", value: formatNumber(latest) }
          ]}
          unit={i.unit}
          values={i.values}
        />
      )
    }),
    Match.tag("Table", (i) => <DataTable columns={i.columns} label={i.label} rows={i.rows} />),
    Match.tag("Text", (i) => (
      <Layer className={surfaceMaterials.evidenceCard}>
        <Stack className="gap-1">
          <SemanticText as="dt" className="text-ink-700" role="row-label" text={i.label} variant="expanded" />
          <SemanticText as="dd" className="text-ink-800" role="row-value" text={i.value} variant="expanded" />
        </Stack>
      </Layer>
    )),
    Match.exhaustive
  )
