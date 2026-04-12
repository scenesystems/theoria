import { Match } from "effect"

import type { EvidencePlaneLayout } from "./plane-presentation.js"

export type EvidenceToolbarControlKey = "filter" | "order" | "section"

export const evidenceToolbarTriggerLabel = (): string => "Adjust"

export const evidenceToolbarPanelEyebrow = (): string => "Evidence controls"

export const evidenceToolbarPanelDescription = (): string =>
  "Tune lens, order, and focus for the current evidence plane."

export const evidenceToolbarLayoutLabel = (layout: EvidencePlaneLayout): string =>
  Match.value(layout._tag).pipe(
    Match.when("Live", () => "Newest-first stream"),
    Match.when("Focused", () => "Focused section"),
    Match.when("Narrative", () => "Narrative lanes"),
    Match.exhaustive
  )

export const evidenceToolbarFocusStatus = (label: string): string => `Focus · ${label}`

export const evidenceToolbarControlLabel = (key: EvidenceToolbarControlKey): string =>
  Match.value(key).pipe(
    Match.when("filter", () => "Lens"),
    Match.when("order", () => "View"),
    Match.when("section", () => "Focus"),
    Match.exhaustive
  )

export const evidenceToolbarControlDescription = (key: EvidenceToolbarControlKey): string =>
  Match.value(key).pipe(
    Match.when("filter", () => "Results, raw data, or supporting context."),
    Match.when("order", () => "Curated narrative ordering or live arrival order."),
    Match.when("section", () => "Lock to a single section."),
    Match.exhaustive
  )
