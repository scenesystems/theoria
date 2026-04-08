import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { EvidenceItem, EvidenceSection } from "../../contracts/evidence/item.js"
import { Program } from "../../contracts/presentation/program.js"
import type { RunData } from "../../contracts/study/run.js"
import { EvidenceRow } from "./primitives/evidence-row.js"

export { type EvidenceRow } from "./primitives/evidence-row.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const PresentedSection = Schema.Struct({
  title: NonEmptyString,
  rows: Schema.Array(EvidenceRow)
})

export type PresentedSection = typeof PresentedSection.Type

export const PresentedRun = Schema.Struct({
  summary: NonEmptyString,
  sections: Schema.Array(PresentedSection),
  program: Program
})

export type PresentedRun = typeof PresentedRun.Type

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

const itemToRow = (item: EvidenceItem): EvidenceRow =>
  Match.value(item).pipe(
    Match.tag(
      "Scalar",
      (s) => ({ label: s.label, value: `${formatNumber(s.value, Option.fromNullable(s.format))} ${s.unit}`.trim() })
    ),
    Match.tag("Comparison", (c) => ({ label: c.label, value: formatComparison(c) })),
    Match.tag("Series", (s) => ({
      label: s.label,
      value: `[${Arr.map(s.values, (v) => v.toFixed(4)).join(", ")}] ${s.unit}`.trim()
    })),
    Match.tag("Table", (t) => ({ label: t.label, value: `${t.rows.length} rows × ${t.columns.length} columns` })),
    Match.tag("Text", (t) => ({ label: t.label, value: t.value })),
    Match.exhaustive
  )

const sectionToPresented = (section: EvidenceSection): PresentedSection => ({
  title: section.title,
  rows: Arr.map(section.items, itemToRow)
})

export const presentSections = (sections: ReadonlyArray<EvidenceSection>): ReadonlyArray<PresentedSection> =>
  Arr.map(sections, sectionToPresented)

export const presentRun = (run: RunData): PresentedRun => ({
  summary: run.summary,
  sections: presentSections(run.sections),
  program: run.program
})
