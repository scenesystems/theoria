import { Match } from "effect"

import type { EvidenceItem } from "../../../contracts/evidence/item.js"

import { formatDelta, formatNumber, formatScalar } from "../data/format.js"
import { ComparisonBar } from "./ComparisonBar.js"
import { DataTable } from "./DataTable.js"
import { EvidenceProse } from "./EvidenceProse.js"
import { MetricCard } from "./MetricCard.js"
import { Sparkline } from "./Sparkline.js"

type EvidenceItemRendererSurface = "panel" | "flush"

export const EvidenceItemRenderer = ({
  item,
  surface = "panel"
}: {
  readonly item: EvidenceItem
  readonly surface?: EvidenceItemRendererSurface
}) =>
  Match.value(item).pipe(
    Match.tag("Scalar", (i) => {
      const value = formatScalar(i.value, "", i.format)
      return <MetricCard label={i.label} surface={surface} unit={i.unit} value={value} />
    }),
    Match.tag("Comparison", (i) => {
      const delta = formatDelta(i.baseline, i.improved, i.direction)
      return (
        <ComparisonBar
          baseline={i.baseline}
          baselineValue={`${formatNumber(i.baseline)} ${i.unit}`}
          deltaText={delta.percentText}
          favorable={delta.favorable}
          improved={i.improved}
          improvedValue={`${formatNumber(i.improved)} ${i.unit}`}
          label={i.label}
          surface={surface}
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
          surface={surface}
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
    Match.tag("Text", (i) => <EvidenceProse items={[i]} />),
    Match.exhaustive
  )
