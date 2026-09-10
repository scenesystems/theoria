import { Match, Schema } from "effect"

import type { Id as CardId } from "../../../contracts/id.js"
import type { Elevation, SurfaceRole } from "../../../contracts/layout.js"
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
  bgTinted: Schema.String,
  /** The wash a value just changed is lit with, before it settles to nothing. */
  wash: Schema.String
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
  bgTinted: "bg-stage-100/70",
  wash: "bg-stage-200"
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
      bgTinted: "bg-tone-text-100/45",
      wash: "bg-tone-text-200"
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
      bgTinted: "bg-tone-search-100/45",
      wash: "bg-tone-search-200"
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
      bgTinted: "bg-tone-math-100/45",
      wash: "bg-tone-math-200"
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
      bgTinted: "bg-tone-dsp-100/45",
      wash: "bg-tone-dsp-200"
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
      bgTinted: "bg-tone-digest-100/45",
      wash: "bg-tone-digest-200"
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
      bgTinted: "bg-tone-sign-100/45",
      wash: "bg-tone-sign-200"
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
      bgTinted: "bg-tone-seal-100/45",
      wash: "bg-tone-seal-200"
    })),
    Match.exhaustive
  )

export const toneClassesForCard = (id: CardId): ToneClasses => toneClassesFor(toneForCard(id))

// ---------------------------------------------------------------------------
// Surfaces — the three things a surface can be, and how each is drawn.
// The canvas is the page: content sits on it with no border, radius or shadow.
// ---------------------------------------------------------------------------

export const surfaceClassName = (role: SurfaceRole): string =>
  Match.value(role).pipe(
    Match.when("canvas", () => ""),
    Match.when("instrument", () => "rounded-instrument bg-instrument"),
    Match.when("overlay", () => "rounded-instrument bg-stage-0 shadow-surface"),
    Match.exhaustive
  )

/** How high a thing stands over the page, in the one order `Elevation` gives. */
export const elevationClassName = (elevation: Elevation): string =>
  Match.value(elevation).pipe(
    Match.when("band", () => "z-10"),
    Match.when("answer", () => "z-20"),
    Match.when("preview", () => "z-30"),
    Match.exhaustive
  )

// ---------------------------------------------------------------------------
// Marks — a thing on the page that can be pointed at and answered. Wherever a
// mark stands — in a line of text, in the code's gutter, on the paper, as a
// value under a line of code — it is lit the same way: one wash, under the
// pointer and while it is answered, whether pointed at itself or lit by the
// answer to another. A mark is `group/mark`, so a chip set inside it can wear
// the wash on its own box instead of the mark's.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Motion — CSS transitions are the page's own and do not read Motion's
// configuration, so a thing that travels by transition (a translate, a scale,
// a height, a rotation) says here that it stands still when the reader asks
// for reduced motion. Motion's own values are configured from the same
// preference at the root; this is the CSS side of one rule.
// ---------------------------------------------------------------------------

/** A transitioned thing that travels; under reduced motion it takes its place at once. */
export const stillUnderReducedMotion = "motion-reduce:transition-none"

/**
 * The one way a control gives up the browser's focus outline for a ring of its
 * own. Rings are box shadows, and forced colours drop every shadow, so the
 * same word brings the outline back there in the system's `Highlight`.
 * `outline-solid`, not `outline`: `outline` resolves its style from
 * `--tw-outline-style`, which `outline-none` has set to none. No class string
 * writes `outline-none` on its own; a contract test holds that. A control that
 * keeps an outline of its own (the discs) wears only the forced-colours half.
 */
export const forcedColorsFocusClassName =
  "forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-2 forced-colors:focus-visible:outline-[Highlight]"
export const focusEdgeClassName = `focus-visible:outline-none ${forcedColorsFocusClassName}`

/** A mark's box: pointable and focusable. The wash is added by whichever box wears it. */
export const markClassName =
  `group/mark cursor-default rounded-md transition-colors duration-150 ease-theme ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink-900/20 ${stillUnderReducedMotion}`

/** The wash on a mark's own box. */
export const litMarkClassName =
  "hover:bg-stage-100/80 data-[place-focused]:bg-stage-100/80 data-[popup-open]:bg-stage-100/80 forced-colors:hover:bg-[Highlight] forced-colors:hover:text-[HighlightText] forced-colors:data-[place-focused]:bg-[Highlight] forced-colors:data-[place-focused]:text-[HighlightText] forced-colors:data-[popup-open]:bg-[Highlight] forced-colors:data-[popup-open]:text-[HighlightText]"

/** The wash on a chip set inside a mark, in place of the chip's own paper. */
export const litChipClassName =
  `transition-colors duration-150 ease-theme ${stillUnderReducedMotion} group-hover/mark:bg-stage-100/80 group-data-[place-focused]/mark:bg-stage-100/80 group-data-[popup-open]/mark:bg-stage-100/80 forced-colors:group-hover/mark:bg-[Highlight] forced-colors:group-hover/mark:text-[HighlightText] forced-colors:group-data-[place-focused]/mark:bg-[Highlight] forced-colors:group-data-[place-focused]/mark:text-[HighlightText] forced-colors:group-data-[popup-open]/mark:bg-[Highlight] forced-colors:group-data-[popup-open]/mark:text-[HighlightText]`

// ---------------------------------------------------------------------------
// InlineStatusTone — a glyph and a colour for a status said in the text's own
// line: a dot in the tone and the words after it. Never a capsule.
// ---------------------------------------------------------------------------

export const InlineStatusTone = Schema.Struct({
  dot: Schema.String,
  text: Schema.String
})
export type InlineStatusTone = typeof InlineStatusTone.Type

export const inlineStatusToneFor = (tone: CardTone): InlineStatusTone => {
  const classes = toneClassesFor(tone)
  return { dot: classes.dot, text: classes.text }
}

export const neutralStatusTone: InlineStatusTone = { dot: neutralToneClasses.dot, text: neutralToneClasses.text }

export const dangerStatusTone: InlineStatusTone = { dot: "bg-danger-500", text: "text-danger-700" }

const pillButtonBaseClassName =
  `inline-flex min-h-9 items-center justify-center rounded-full border px-4 py-2 transition-colors duration-150 ease-out ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55`

export const pillButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: ToneClasses
}): string =>
  active
    ? `${pillButtonBaseClassName} ${tone.borderSubtle} ${tone.bgTinted}`
    : `${pillButtonBaseClassName} border-transparent bg-stage-100/70 hover:bg-stage-100`

const segmentedControlRailBaseClassName = "grid min-w-0 gap-1 rounded-instrument border border-rule bg-instrument p-1"

/**
 * A segmented control is one row of equal cells at every width the cells can
 * hold: up to three stay side by side on a phone; four fold to two rows below
 * the small breakpoint.
 */
export const segmentedControlRailClassName = (count: number): string =>
  count <= 2
    ? `${segmentedControlRailBaseClassName} grid-cols-2`
    : count === 3
    ? `${segmentedControlRailBaseClassName} grid-cols-3`
    : `${segmentedControlRailBaseClassName} grid-cols-2 sm:grid-cols-4`

const segmentedControlButtonBaseClassName =
  `inline-flex min-h-10 min-w-0 items-center justify-center rounded-control border border-transparent px-3 py-2 transition-colors duration-150 ease-out ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55`

export const segmentedControlButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: ToneClasses
}): string =>
  active
    ? `${segmentedControlButtonBaseClassName} border-rule bg-stage-0 ${tone.bgTinted}`
    : `${segmentedControlButtonBaseClassName} hover:bg-stage-0/60`

const toggleTrackBaseClassName =
  `inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150 ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55 forced-colors:border-[CanvasText]`

export const toggleTrackClassName = ({
  checked,
  tone
}: {
  readonly checked: boolean
  readonly tone: ToneClasses
}): string =>
  checked
    ? `${toggleTrackBaseClassName} ${tone.border} ${tone.bg} ${tone.focusRing} forced-colors:bg-[Highlight]`
    : `${toggleTrackBaseClassName} border-stage-200/90 bg-stage-50/90 ${tone.focusRing}`

/**
 * The page is the canvas: one column of content on the document's own
 * canvas, nothing floating over it. The root paints nothing itself — the
 * body is the canvas, in the stage's colour — so the home page and the docs
 * stand on the same ground, and no story changes it. The column adds no
 * space of its own between what it holds: each block owns its distance from
 * the next (the hero's lead and trail, the footer's `region`), so every
 * distance on the page has one source.
 */
export const appTheme = {
  root:
    "relative min-h-screen overflow-x-clip font-body text-ink-900 antialiased selection:bg-tone-text-200/60 selection:text-ink-950",
  content: "relative mx-auto flex w-full max-w-[88rem] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12"
}
