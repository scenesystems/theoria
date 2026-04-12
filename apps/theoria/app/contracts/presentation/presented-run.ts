import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { EvidenceItem, EvidenceSection } from "../evidence/item.js"
import type { RunData } from "../study/run.js"

import { PresentationDetailRow, presentationDetailRow } from "./detail-row.js"
import { Program } from "./program.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export class PresentedSection extends Schema.Class<PresentedSection>("PresentedSection")({
  title: NonEmptyString,
  rows: Schema.Array(PresentationDetailRow)
}) {}

export class PresentedRun extends Schema.Class<PresentedRun>("PresentedRun")({
  summary: NonEmptyString,
  sections: Schema.Array(PresentedSection),
  program: Program
}) {}

const formatNumber = (value: number, format: Option.Option<string>): string =>
  Option.match(format, {
    onNone: () => value.toFixed(6),
    onSome: (resolvedFormat) =>
      Match.value(resolvedFormat).pipe(
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
      (scalar) =>
        presentationDetailRow(
          scalar.label,
          `${formatNumber(scalar.value, Option.fromNullable(scalar.format))} ${scalar.unit}`.trim()
        )
    ),
    Match.tag("Comparison", (comparison) => presentationDetailRow(comparison.label, formatComparison(comparison))),
    Match.tag(
      "Series",
      (series) =>
        presentationDetailRow(
          series.label,
          `[${Arr.map(series.values, (value) => value.toFixed(4)).join(", ")}] ${series.unit}`.trim()
        )
    ),
    Match.tag(
      "Table",
      (table) => presentationDetailRow(table.label, `${table.rows.length} rows × ${table.columns.length} columns`)
    ),
    Match.tag("Text", (text) => presentationDetailRow(text.label, text.value)),
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
