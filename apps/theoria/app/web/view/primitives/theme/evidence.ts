import { Match } from "effect"

import type { CardTone } from "../../../../contracts/tone.js"

import { toneFor } from "./tone.js"

export type EvidenceSection = {
  readonly accent: string
  readonly badge: string
  readonly frame: string
  readonly eyebrow: string
}

export const evidenceSectionFor = (
  variant: "highlight" | "analysis" | "context" | "dataset"
): EvidenceSection =>
  Match.value(variant).pipe(
    Match.when("highlight", () => ({
      accent: "bg-ink-900",
      badge: "bg-stage-100 text-ink-900",
      frame: "rounded-[1.6rem] border border-stage-300/90 bg-stage-0/96 shadow-surface ring-1 ring-stage-0/60",
      eyebrow: "text-ink-600"
    })),
    Match.when("analysis", () => ({
      accent: "bg-stage-400",
      badge: "bg-stage-100 text-ink-800",
      frame: "rounded-[1.6rem] border border-stage-200/90 bg-stage-0/90 shadow-chip",
      eyebrow: "text-ink-600"
    })),
    Match.when("context", () => ({
      accent: "bg-stage-300",
      badge: "bg-stage-0/90 text-ink-700",
      frame: "rounded-[1.6rem] border border-stage-200/75 bg-stage-50/72 shadow-chip",
      eyebrow: "text-ink-600"
    })),
    Match.when("dataset", () => ({
      accent: "bg-stage-400",
      badge: "bg-stage-100 text-ink-700",
      frame: "rounded-[1.6rem] border border-stage-200/90 bg-stage-0/88 shadow-chip",
      eyebrow: "text-ink-600"
    })),
    Match.exhaustive
  )

export type Legend = {
  readonly swatch: string
  readonly label: string
}

export const neutralLegend: Legend = {
  swatch: "bg-ink-700",
  label: "text-ink-700"
}

export const neutralSubtleLegend: Legend = {
  swatch: "bg-ink-300 ring-1 ring-ink-400/50",
  label: "text-ink-700"
}

export const dangerSubtleLegend: Legend = {
  swatch: "bg-danger-500/40",
  label: "text-ink-700"
}

export const legendFor = (tone: CardTone): Legend => ({
  swatch: toneFor(tone).bg,
  label: "text-ink-700"
})
