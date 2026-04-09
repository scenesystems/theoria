import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import type { EvidenceItem, EvidenceSection } from "../../contracts/evidence/item.js"
import { type PresentationDetailRow, presentationDetailRow } from "../../contracts/presentation/detail-row.js"
import { PresentedRun, PresentedSection } from "../../contracts/presentation/presented-run.js"
import type { RunData } from "../../contracts/study/run.js"

export { PresentedRun, PresentedSection } from "../../contracts/presentation/presented-run.js"

const formatNumber = (value: number, format: Option.Option<string>): string =>
  Option.match(format, {
    onNone: () => value.toFixed(6),
    onSome: (f) =>
      Match.value(f).pipe(
        Match.when("integer", () => String(Math.round(value))),
        Match.when("scientific", () => value.toExponential(6)),
        Match.when("percent", () => `${value.toFixed(2)}%`),
        Match.orElse(() => value.toFixed(6))
      )
  })

const formatComparison = (item: Extract<EvidenceItem, { readonly _tag: "Comparison" }>): string => {
  const delta = item.direction === "lower-is-better"
    ? item.baseline - item.improved
    : item.improved - item.baseline
  const denominator = Math.abs(item.baseline) < 1e-9 ? 1 : Math.abs(item.baseline)
  const deltaPercent = (delta / denominator) * 100
  const prefix = deltaPercent >= 0 ? "+" : ""
  return `${formatNumber(item.baseline, Option.some("fixed"))} → ${
    formatNumber(item.improved, Option.some("fixed"))
  } ${item.unit} (${prefix}${deltaPercent.toFixed(2)}%)`
}

const itemToRow = (item: EvidenceItem): PresentationDetailRow =>
  Match.value(item).pipe(
    Match.tag(
      "Scalar",
      (s) => presentationDetailRow(s.label, `${formatNumber(s.value, Option.fromNullable(s.format))} ${s.unit}`.trim())
    ),
    Match.tag("Comparison", (c) => presentationDetailRow(c.label, formatComparison(c))),
    Match.tag(
      "Series",
      (s) => presentationDetailRow(s.label, `[${Arr.map(s.values, (v) => v.toFixed(4)).join(", ")}] ${s.unit}`.trim())
    ),
    Match.tag("Table", (t) => presentationDetailRow(t.label, `${t.rows.length} rows × ${t.columns.length} columns`)),
    Match.tag("Text", (t) => presentationDetailRow(t.label, t.value)),
    Match.exhaustive
  )

const sectionToPresented = (section: EvidenceSection): PresentedSection =>
  PresentedSection.make({
    title: section.title,
    rows: Arr.map(section.items, itemToRow)
  })

export const presentSections = (sections: ReadonlyArray<EvidenceSection>): ReadonlyArray<PresentedSection> =>
  Arr.map(sections, sectionToPresented)

export const presentRun = (run: RunData): PresentedRun =>
  PresentedRun.make({
    summary: run.summary,
    sections: presentSections(run.sections),
    program: run.program
  })
