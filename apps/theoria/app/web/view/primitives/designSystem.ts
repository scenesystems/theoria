import { Match, Schema } from "effect"

import type { Id as CardId } from "../../../contracts/id.js"
import { type CardTone, toneForCard } from "../../../contracts/theme.js"

// ---------------------------------------------------------------------------
// ToneClasses — derived Tailwind class sets for per-tone UI elements.
// Every class string is a full literal — Tailwind v4 purges dynamic names.
// ---------------------------------------------------------------------------

export const ToneClasses = Schema.Struct({
  indicator: Schema.String,
  border: Schema.String,
  borderSubtle: Schema.String,
  borderHover: Schema.String,
  focusRing: Schema.String,
  dot: Schema.String,
  text: Schema.String,
  textStrong: Schema.String,
  textMuted: Schema.String,
  fill: Schema.String,
  fillMuted: Schema.String,
  stroke: Schema.String,
  bg: Schema.String,
  bgSubtle: Schema.String,
  bgTinted: Schema.String
})
export type ToneClasses = typeof ToneClasses.Type

export const neutralToneClasses: ToneClasses = {
  indicator: "bg-stage-400",
  border: "border-stage-400",
  borderSubtle: "border-stage-200/95",
  borderHover: "hover:border-stage-300",
  focusRing: "focus-visible:ring-stage-300",
  dot: "bg-stage-400",
  text: "text-ink-700",
  textStrong: "text-ink-900",
  textMuted: "text-ink-500",
  fill: "fill-ink-700",
  fillMuted: "fill-ink-400",
  stroke: "stroke-ink-700",
  bg: "bg-stage-400",
  bgSubtle: "bg-stage-100",
  bgTinted: "bg-stage-100/70"
}

export const toneClassesFor = (tone: CardTone): ToneClasses =>
  Match.value(tone).pipe(
    Match.when("text", () => ({
      indicator: "bg-tone-text-500",
      border: "border-tone-text-500",
      borderSubtle: "border-tone-text-200/95",
      borderHover: "hover:border-tone-text-300",
      focusRing: "focus-visible:ring-tone-text-300",
      dot: "bg-tone-text-400",
      text: "text-tone-text-700",
      textStrong: "text-tone-text-900",
      textMuted: "text-tone-text-500",
      fill: "fill-tone-text-500",
      fillMuted: "fill-tone-text-300",
      stroke: "stroke-tone-text-500",
      bg: "bg-tone-text-500",
      bgSubtle: "bg-tone-text-100",
      bgTinted: "bg-tone-text-100/45"
    })),
    Match.when("search", () => ({
      indicator: "bg-tone-search-500",
      border: "border-tone-search-500",
      borderSubtle: "border-tone-search-200/95",
      borderHover: "hover:border-tone-search-300",
      focusRing: "focus-visible:ring-tone-search-300",
      dot: "bg-tone-search-400",
      text: "text-tone-search-700",
      textStrong: "text-tone-search-900",
      textMuted: "text-tone-search-500",
      fill: "fill-tone-search-500",
      fillMuted: "fill-tone-search-300",
      stroke: "stroke-tone-search-500",
      bg: "bg-tone-search-500",
      bgSubtle: "bg-tone-search-100",
      bgTinted: "bg-tone-search-100/45"
    })),
    Match.when("math", () => ({
      indicator: "bg-tone-math-500",
      border: "border-tone-math-500",
      borderSubtle: "border-tone-math-200/95",
      borderHover: "hover:border-tone-math-300",
      focusRing: "focus-visible:ring-tone-math-300",
      dot: "bg-tone-math-400",
      text: "text-tone-math-700",
      textStrong: "text-tone-math-900",
      textMuted: "text-tone-math-500",
      fill: "fill-tone-math-500",
      fillMuted: "fill-tone-math-300",
      stroke: "stroke-tone-math-500",
      bg: "bg-tone-math-500",
      bgSubtle: "bg-tone-math-100",
      bgTinted: "bg-tone-math-100/45"
    })),
    Match.when("dsp", () => ({
      indicator: "bg-tone-dsp-500",
      border: "border-tone-dsp-500",
      borderSubtle: "border-tone-dsp-200/95",
      borderHover: "hover:border-tone-dsp-300",
      focusRing: "focus-visible:ring-tone-dsp-300",
      dot: "bg-tone-dsp-400",
      text: "text-tone-dsp-700",
      textStrong: "text-tone-dsp-900",
      textMuted: "text-tone-dsp-500",
      fill: "fill-tone-dsp-500",
      fillMuted: "fill-tone-dsp-300",
      stroke: "stroke-tone-dsp-500",
      bg: "bg-tone-dsp-500",
      bgSubtle: "bg-tone-dsp-100",
      bgTinted: "bg-tone-dsp-100/45"
    })),
    Match.when("digest", () => ({
      indicator: "bg-tone-digest-500",
      border: "border-tone-digest-500",
      borderSubtle: "border-tone-digest-200/95",
      borderHover: "hover:border-tone-digest-300",
      focusRing: "focus-visible:ring-tone-digest-300",
      dot: "bg-tone-digest-400",
      text: "text-tone-digest-700",
      textStrong: "text-tone-digest-900",
      textMuted: "text-tone-digest-500",
      fill: "fill-tone-digest-500",
      fillMuted: "fill-tone-digest-300",
      stroke: "stroke-tone-digest-500",
      bg: "bg-tone-digest-500",
      bgSubtle: "bg-tone-digest-100",
      bgTinted: "bg-tone-digest-100/45"
    })),
    Match.when("sign", () => ({
      indicator: "bg-tone-sign-500",
      border: "border-tone-sign-500",
      borderSubtle: "border-tone-sign-200/95",
      borderHover: "hover:border-tone-sign-300",
      focusRing: "focus-visible:ring-tone-sign-300",
      dot: "bg-tone-sign-400",
      text: "text-tone-sign-700",
      textStrong: "text-tone-sign-900",
      textMuted: "text-tone-sign-500",
      fill: "fill-tone-sign-500",
      fillMuted: "fill-tone-sign-300",
      stroke: "stroke-tone-sign-500",
      bg: "bg-tone-sign-500",
      bgSubtle: "bg-tone-sign-100",
      bgTinted: "bg-tone-sign-100/45"
    })),
    Match.when("seal", () => ({
      indicator: "bg-tone-seal-500",
      border: "border-tone-seal-500",
      borderSubtle: "border-tone-seal-200/95",
      borderHover: "hover:border-tone-seal-300",
      focusRing: "focus-visible:ring-tone-seal-300",
      dot: "bg-tone-seal-400",
      text: "text-tone-seal-700",
      textStrong: "text-tone-seal-900",
      textMuted: "text-tone-seal-500",
      fill: "fill-tone-seal-500",
      fillMuted: "fill-tone-seal-300",
      stroke: "stroke-tone-seal-500",
      bg: "bg-tone-seal-500",
      bgSubtle: "bg-tone-seal-100",
      bgTinted: "bg-tone-seal-100/45"
    })),
    Match.exhaustive
  )

export const toneClassesForCard = (id: CardId): ToneClasses => toneClassesFor(toneForCard(id))

// ---------------------------------------------------------------------------
// ContentCardTone — semantic tone overlay for ContentCard.
// ---------------------------------------------------------------------------

export const ContentCardToneClasses = Schema.Struct({
  border: Schema.String,
  bg: Schema.String
})
export type ContentCardToneClasses = typeof ContentCardToneClasses.Type

export const contentCardToneClassesFor = (tone: CardTone): ContentCardToneClasses => {
  const classes = toneClassesFor(tone)
  return { border: classes.borderSubtle, bg: classes.bgTinted }
}

export const surfaceMaterials = {
  raisedCard:
    "rounded-[2rem] border border-stage-300/95 bg-stage-0/94 shadow-hero ring-1 ring-stage-0/80 backdrop-blur-sm",
  calloutError: "rounded-md border border-danger-200/80 bg-danger-50/70 px-3 py-3"
}

const pillButtonBaseClassName =
  "inline-flex min-h-9 items-center justify-center rounded-full border px-4 py-2 transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"

export const pillButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: ToneClasses
}): string =>
  active
    ? `${pillButtonBaseClassName} border-stage-300/90 bg-stage-0/96 shadow-chip ring-1 ring-stage-0/65 hover:border-stage-400 ${tone.borderSubtle} ${tone.bgTinted}`
    : `${pillButtonBaseClassName} border-stage-200/95 bg-stage-50/72 hover:border-stage-300 hover:bg-stage-0/90`

const segmentedControlRailBaseClassName =
  "grid min-w-0 gap-1 rounded-[1rem] border border-stage-200/80 bg-stage-50/38 p-1"

export const segmentedControlRailClassName = (count: number): string =>
  count <= 2
    ? `${segmentedControlRailBaseClassName} grid-cols-2`
    : count === 3
    ? `${segmentedControlRailBaseClassName} grid-cols-1 sm:grid-cols-3`
    : `${segmentedControlRailBaseClassName} grid-cols-2 sm:grid-cols-4`

const segmentedControlButtonBaseClassName =
  "inline-flex min-h-10 min-w-0 items-center justify-center rounded-[0.9rem] border border-transparent px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"

export const segmentedControlButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: ToneClasses
}): string =>
  active
    ? `${segmentedControlButtonBaseClassName} border-stage-200/80 bg-stage-0/88 ${tone.bgTinted}`
    : `${segmentedControlButtonBaseClassName} hover:border-stage-200/70 hover:bg-stage-0/52`

const toggleTrackBaseClassName =
  "inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"

export const toggleTrackClassName = ({
  checked,
  tone
}: {
  readonly checked: boolean
  readonly tone: ToneClasses
}): string =>
  checked
    ? `${toggleTrackBaseClassName} ${tone.border} ${tone.bg} ${tone.focusRing}`
    : `${toggleTrackBaseClassName} border-stage-200/90 bg-stage-50/90 ${tone.focusRing}`

export const appTheme = {
  root:
    "relative min-h-screen overflow-x-clip bg-stage-50 font-body text-ink-900 antialiased selection:bg-tone-text-200/60 selection:text-ink-950",
  atmosphericGlowA: "pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-stage-0/85 blur-3xl",
  atmosphericGlowB:
    "pointer-events-none absolute -right-24 top-24 h-[21rem] w-[21rem] rounded-full bg-stage-100/90 blur-3xl",
  content: "relative mx-auto flex w-full max-w-[84rem] flex-col gap-4 px-4 py-7 sm:px-7 sm:py-9 lg:px-10"
}

// ---------------------------------------------------------------------------
// LegendTheme — resolved styling for chart legends.
// ---------------------------------------------------------------------------

export const LegendTheme = Schema.Struct({
  swatch: Schema.String,
  label: Schema.String
})
export type LegendTheme = typeof LegendTheme.Type

export const legendThemeFor = (tone: CardTone): LegendTheme => ({
  swatch: toneClassesFor(tone).bg,
  label: "text-ink-700"
})
