import { Match } from "effect"
import * as Option from "effect/Option"

import type { Id as CardId } from "../../../contracts/id.js"
import { type CardTone, toneForCard } from "../../../contracts/theme.js"

// ---------------------------------------------------------------------------
// ToneClasses — derived Tailwind class sets for per-tone UI elements.
// Every class string is a full literal — Tailwind v4 purges dynamic names.
// ---------------------------------------------------------------------------

export type ToneClasses = {
  readonly indicator: string
  readonly border: string
  readonly borderSubtle: string
  readonly borderHover: string
  readonly focusRing: string
  readonly dot: string
  readonly text: string
  readonly textStrong: string
  readonly textMuted: string
  readonly fill: string
  readonly fillMuted: string
  readonly stroke: string
  readonly bg: string
  readonly bgSubtle: string
  readonly bgTinted: string
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
// MetricAppearance — semantic styling contract for metric values.
// View models express WHAT (tone, emphasis, danger) — never HOW (CSS classes).
// ---------------------------------------------------------------------------

export type MetricEmphasis = "default" | "muted" | "strong"

export type MetricAppearance =
  | { readonly _tag: "neutral" }
  | { readonly _tag: "tone"; readonly tone: CardTone }
  | { readonly _tag: "danger" }

export type MetricPillClasses = {
  readonly label: string
  readonly value: string
}

const neutralPillClasses: MetricPillClasses = { label: "text-ink-700", value: "text-ink-900" }

export const metricPillClassesFor = (
  appearance: Option.Option<MetricAppearance>,
  enabled: boolean
): MetricPillClasses =>
  !enabled
    ? neutralPillClasses
    : Option.match(appearance, {
      onNone: () => neutralPillClasses,
      onSome: (resolvedAppearance) =>
        Match.value(resolvedAppearance).pipe(
          Match.tag("neutral", () => neutralPillClasses),
          Match.tag("danger", () => ({ label: "text-ink-700", value: "text-danger-600" })),
          Match.tag("tone", ({ tone }) => ({ label: "text-ink-700", value: toneClassesFor(tone).text })),
          Match.exhaustive
        )
    })

// ---------------------------------------------------------------------------
// ContentCardTone — semantic tone overlay for ContentCard.
// Replaces raw className injection with a resolved tone contract.
// ---------------------------------------------------------------------------

export type ContentCardToneClasses = {
  readonly border: string
  readonly bg: string
}

export const contentCardToneClassesFor = (tone: CardTone): ContentCardToneClasses => {
  const classes = toneClassesFor(tone)
  return { border: classes.borderSubtle, bg: classes.bgTinted }
}

export const contentCardDangerClasses: ContentCardToneClasses = {
  border: "border-danger-200/80",
  bg: "bg-danger-50/70"
}

export type SurfaceMaterials = {
  readonly raisedCard: string
  readonly supportPanel: string
  readonly supportPanelDense: string
  readonly stripPanel: string
  readonly callout: string
  readonly calloutError: string
  readonly evidenceCardFrame: string
  readonly evidenceCard: string
  readonly chartFrame: string
}

export const surfaceMaterials: SurfaceMaterials = {
  raisedCard:
    "rounded-[2rem] border border-stage-300/95 bg-stage-0/94 shadow-hero ring-1 ring-stage-0/80 backdrop-blur-sm",
  supportPanel: "rounded-2xl border border-stage-200/90 bg-stage-0/88 shadow-chip",
  supportPanelDense: "rounded-2xl border border-stage-200/90 bg-stage-0/88 px-3 py-2 shadow-chip",
  stripPanel: "flex-wrap gap-3 rounded-xl border border-stage-200/80 bg-stage-0/72 px-3 py-2 shadow-chip",
  callout: "rounded-md border border-stage-200/95 bg-stage-50/85 px-3 py-3",
  calloutError: "rounded-md border border-danger-200/80 bg-danger-50/70 px-3 py-3",
  evidenceCardFrame: "rounded-lg border border-stage-200/80 bg-stage-0/60",
  evidenceCard: "rounded-lg border border-stage-200/80 bg-stage-0/60 px-4 py-3",
  chartFrame: "rounded-lg border border-stage-200/80 bg-stage-50/60 shadow-chip"
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
    ? `${toggleTrackBaseClassName} border-stage-300/90 ${tone.border} ${tone.bgTinted} ${tone.focusRing}`
    : `${toggleTrackBaseClassName} border-stage-200/90 bg-stage-50/90 ${tone.focusRing}`

export type ObstacleToneClasses = {
  readonly shell: string
  readonly accent: string
  readonly label: string
  readonly meta: string
  readonly badge: string
  readonly glyphPanel: string
  readonly glyphMuted: string
}

export const obstacleToneClassesFor = (tone: CardTone): ObstacleToneClasses =>
  Match.value(tone).pipe(
    Match.when("text", () => ({
      shell: "border-tone-text-300/60 bg-stage-0/80",
      accent: "bg-tone-text-500",
      label: "text-tone-text-900",
      meta: "text-tone-text-700",
      badge: "border-tone-text-300/70 bg-stage-0/88 text-tone-text-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("search", () => ({
      shell: "border-tone-search-300/60 bg-stage-0/80",
      accent: "bg-tone-search-500",
      label: "text-tone-search-900",
      meta: "text-tone-search-700",
      badge: "border-tone-search-300/70 bg-stage-0/88 text-tone-search-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("math", () => ({
      shell: "border-tone-math-300/60 bg-stage-0/80",
      accent: "bg-tone-math-500",
      label: "text-tone-math-900",
      meta: "text-tone-math-700",
      badge: "border-tone-math-300/70 bg-stage-0/88 text-tone-math-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("dsp", () => ({
      shell: "border-tone-dsp-300/60 bg-stage-0/80",
      accent: "bg-tone-dsp-500",
      label: "text-tone-dsp-900",
      meta: "text-tone-dsp-700",
      badge: "border-tone-dsp-300/70 bg-stage-0/88 text-tone-dsp-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("digest", () => ({
      shell: "border-tone-digest-300/60 bg-stage-0/80",
      accent: "bg-tone-digest-500",
      label: "text-tone-digest-900",
      meta: "text-tone-digest-700",
      badge: "border-tone-digest-300/70 bg-stage-0/88 text-tone-digest-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("sign", () => ({
      shell: "border-tone-sign-300/60 bg-stage-0/80",
      accent: "bg-tone-sign-500",
      label: "text-tone-sign-900",
      meta: "text-tone-sign-700",
      badge: "border-tone-sign-300/70 bg-stage-0/88 text-tone-sign-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("seal", () => ({
      shell: "border-tone-seal-300/60 bg-stage-0/80",
      accent: "bg-tone-seal-500",
      label: "text-tone-seal-900",
      meta: "text-tone-seal-700",
      badge: "border-tone-seal-300/70 bg-stage-0/88 text-tone-seal-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.exhaustive
  )

export const appTheme = {
  root:
    "relative min-h-screen overflow-x-hidden bg-stage-50 font-body text-ink-900 antialiased selection:bg-tone-text-200/60 selection:text-ink-950",
  atmosphericGlowA: "pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-stage-0/85 blur-3xl",
  atmosphericGlowB:
    "pointer-events-none absolute -right-24 top-24 h-[21rem] w-[21rem] rounded-full bg-stage-100/90 blur-3xl",
  content: "relative mx-auto flex w-full max-w-[84rem] flex-col gap-4 px-4 py-7 sm:px-7 sm:py-9 lg:px-10",
  compactNav:
    "flex items-center justify-between gap-4 border-b border-stage-200/90 bg-stage-0/92 px-4 py-3 backdrop-blur-sm sm:px-6",
  homeGrid: "grid grid-cols-1 gap-4 xl:grid-cols-2"
}

export type CodePanelTheme = {
  readonly bg: string
  readonly action: string
  readonly codeContainer: string
  readonly editorHeader: string
  readonly explorer: string
  readonly explorerItem: string
  readonly explorerItemActive: string
  readonly metaBorder: string
  readonly metaHint: string
  readonly metaLabel: string
  readonly metaValue: string
  readonly scrollbar: string
  readonly scrollCorner: string
  readonly statusBar: string
  readonly title: string
  readonly workspace: string
}

export type SurfaceTheme = {
  readonly shell: string
  readonly accent: string
  readonly badge: string
  readonly badgeDot: string
  readonly statusTag: string
  readonly primaryAction: string
  readonly backAction: string
  readonly secondaryAction: string
  readonly splitDivider: string
  readonly splitHandle: string
  readonly tabActive: string
  readonly tabInactive: string
  readonly panel: string
  readonly codePanel: CodePanelTheme
}

const shellShared = "border border-stage-300/85 bg-stage-0/92 shadow-surface ring-1 ring-stage-0/70 backdrop-blur-sm"

const panelShared = "border border-stage-200/95 bg-stage-0/74 shadow-chip"

const statusTagShared = "border-stage-200/90 bg-stage-50/90 text-ink-900"

const actionShared = "shadow-chip focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1"

const primaryActionShared = "border-ink-900/90 bg-ink-900 text-stage-0 hover:border-ink-800 hover:bg-ink-800"

const backActionShared =
  "border-transparent bg-transparent text-ink-700 hover:border-stage-300 hover:bg-stage-100/80 hover:text-ink-900"

const secondaryActionShared =
  "border-stage-300 bg-stage-0/96 text-ink-800 hover:border-stage-400 hover:bg-stage-50 hover:text-ink-900"

const splitDividerShared =
  "bg-stage-200/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-0 hover:bg-stage-300/95"

const splitHandleShared =
  "after:absolute after:left-1/2 after:top-1/2 after:h-14 after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-stage-300 after:bg-stage-0/96 after:shadow-chip"

const tabActiveShared = "border-stage-300 bg-stage-0/98 text-ink-900 shadow-chip"

const tabInactiveShared =
  "border-transparent bg-transparent text-ink-700 hover:border-stage-300 hover:bg-stage-0/90 hover:text-ink-900"

const codePanelShared: CodePanelTheme = {
  bg: "bg-stage-100",
  action:
    "shadow-chip border-stage-300/60 bg-stage-100/80 text-ink-700 hover:border-stage-400 hover:bg-stage-200/80 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1",
  codeContainer: "bg-stage-50",
  editorHeader: "bg-stage-50/92",
  explorer: "bg-stage-100/84",
  explorerItem:
    "border-transparent bg-transparent text-ink-700 hover:border-stage-300/70 hover:bg-stage-50/88 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1",
  explorerItemActive:
    "border-stage-300/90 bg-stage-0/96 text-ink-900 shadow-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1",
  metaBorder: "border-stage-200/60",
  metaHint: "text-ink-700/60",
  metaLabel: "text-ink-700",
  metaValue: "text-ink-800",
  scrollbar: "bg-stage-200/40",
  scrollCorner: "bg-stage-100",
  statusBar: "bg-stage-100/88",
  title: "text-ink-900",
  workspace: "bg-stage-100"
}

type ToneSurfaceAccent = {
  readonly accent: string
  readonly badgeDot: string
}

const toneSurfaceAccent = (tone: CardTone): ToneSurfaceAccent =>
  Match.value(tone).pipe(
    Match.when("text", () => ({
      accent: "bg-gradient-to-r from-tone-text-600 via-tone-text-500 to-tone-text-400",
      badgeDot: "bg-tone-text-500"
    })),
    Match.when("search", () => ({
      accent: "bg-gradient-to-r from-tone-search-600 via-tone-search-500 to-tone-search-400",
      badgeDot: "bg-tone-search-500"
    })),
    Match.when("math", () => ({
      accent: "bg-gradient-to-r from-tone-math-600 via-tone-math-500 to-tone-math-400",
      badgeDot: "bg-tone-math-500"
    })),
    Match.when("dsp", () => ({
      accent: "bg-gradient-to-r from-tone-dsp-600 via-tone-dsp-500 to-tone-dsp-400",
      badgeDot: "bg-tone-dsp-500"
    })),
    Match.when("digest", () => ({
      accent: "bg-gradient-to-r from-tone-digest-600 via-tone-digest-500 to-tone-digest-400",
      badgeDot: "bg-tone-digest-500"
    })),
    Match.when("sign", () => ({
      accent: "bg-gradient-to-r from-tone-sign-600 via-tone-sign-500 to-tone-sign-400",
      badgeDot: "bg-tone-sign-500"
    })),
    Match.when("seal", () => ({
      accent: "bg-gradient-to-r from-tone-seal-600 via-tone-seal-500 to-tone-seal-400",
      badgeDot: "bg-tone-seal-500"
    })),
    Match.exhaustive
  )

const surfaceThemeForTone = (tone: CardTone): SurfaceTheme => {
  const toneAccent = toneSurfaceAccent(tone)

  return {
    shell: shellShared,
    accent: toneAccent.accent,
    badge: "border-stage-300/90 bg-stage-0/96 text-ink-800 shadow-chip",
    badgeDot: toneAccent.badgeDot,
    statusTag: statusTagShared,
    primaryAction: `${actionShared} ${primaryActionShared}`,
    backAction: `${actionShared} ${backActionShared}`,
    secondaryAction: `${actionShared} ${secondaryActionShared}`,
    splitDivider: splitDividerShared,
    splitHandle: splitHandleShared,
    tabActive: tabActiveShared,
    tabInactive: tabInactiveShared,
    panel: panelShared,
    codePanel: codePanelShared
  }
}

export const surfaceThemeForCard = (id: CardId): SurfaceTheme => surfaceThemeForTone(toneForCard(id))

// ---------------------------------------------------------------------------
// BadgeTheme — resolved styling for PackageBadge.
// ---------------------------------------------------------------------------

export type BadgeTheme = {
  readonly shell: string
  readonly dot: string
  readonly label?: string
}

export const badgeThemeFromSurface = (theme: SurfaceTheme): BadgeTheme => ({
  shell: theme.badge,
  dot: theme.badgeDot
})

export const neutralBadgeTheme: BadgeTheme = {
  shell: "border-stage-300/90 bg-stage-0/96 text-ink-800",
  dot: "bg-stage-400",
  label: "text-ink-700"
}

// ---------------------------------------------------------------------------
// LegendTheme — resolved styling for chart legends.
// ---------------------------------------------------------------------------

export type LegendTheme = {
  readonly swatch: string
  readonly label: string
}

export const neutralLegendTheme: LegendTheme = {
  swatch: "bg-ink-700",
  label: "text-ink-700"
}

export const neutralSubtleLegendTheme: LegendTheme = {
  swatch: "bg-ink-300 ring-1 ring-ink-400/50",
  label: "text-ink-700"
}

export const dangerSubtleLegendTheme: LegendTheme = {
  swatch: "bg-danger-500/40",
  label: "text-ink-700"
}

export const legendThemeFor = (tone: CardTone): LegendTheme => ({
  swatch: toneClassesFor(tone).bg,
  label: "text-ink-700"
})
