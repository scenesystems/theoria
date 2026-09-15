import { Boolean as Bool, Match, Number as Num, Schema } from "effect"
import * as Arr from "effect/Array"

import type { Id as CardId } from "../../../contracts/id.js"
import type { Elevation, SurfaceRole } from "../../../contracts/layout.js"
import {
  type DiscSlot,
  discSlotRole,
  neutralSlotRole,
  type ToneRole,
  ToneSlot,
  toneSlotRole
} from "../../../contracts/palette.js"
import { type CardTone, toneForCard } from "../../../contracts/theme.js"

// ---------------------------------------------------------------------------
// ToneClasses — the class a component's slot wears in a tone, derived from the
// palette contract: the slot says which role it reads (`toneSlotRole`), and
// this file says which utility paints it. Tailwind cannot see a class composed
// here, so the palette generator declares every one as a candidate
// (`@source inline`) in the generated stylesheet; a contract test holds that.
// ---------------------------------------------------------------------------

/** The utility a slot is worn as: the property it paints, with the variant that lights it. */
const slotUtility = (slot: ToneSlot): string =>
  Match.value(slot).pipe(
    Match.whenOr("border", "borderSubtle", () => "border"),
    Match.when("focusRing", () => "focus-visible:ring"),
    Match.whenOr("dot", "bg", "bgTinted", "wash", () => "bg"),
    Match.whenOr("text", "textStrong", () => "text"),
    Match.when("stroke", () => "stroke"),
    Match.exhaustive
  )

/** The translucency a slot is painted at: a chosen pill's edge and fill let the paper through; the rest are solid. */
const slotAlpha = (slot: ToneSlot): string =>
  Match.value(slot).pipe(
    Match.when("borderSubtle", () => "/95"),
    Match.when("bgTinted", () => "/45"),
    Match.whenOr("border", "focusRing", "dot", "text", "textStrong", "stroke", "bg", "wash", () => ""),
    Match.exhaustive
  )

/** The name Tailwind knows a tone's role by, as the generated bridge declares it. */
export const toneColorName = (tone: CardTone, role: ToneRole): string => `tone-${tone}-${role}`

const toneSlotClassName = (tone: CardTone, slot: ToneSlot): string =>
  `${slotUtility(slot)}-${toneColorName(tone, toneSlotRole(slot))}${slotAlpha(slot)}`

const neutralSlotClassName = (slot: ToneSlot): string =>
  `${slotUtility(slot)}-${neutralSlotRole(slot)}${slotAlpha(slot)}`

export const ToneClasses = Schema.Record({ key: ToneSlot, value: Schema.String })
export type ToneClasses = typeof ToneClasses.Type

const slotClasses = (className: (slot: ToneSlot) => string): ToneClasses => ({
  border: className("border"),
  borderSubtle: className("borderSubtle"),
  focusRing: className("focusRing"),
  dot: className("dot"),
  text: className("text"),
  textStrong: className("textStrong"),
  stroke: className("stroke"),
  bg: className("bg"),
  bgTinted: className("bgTinted"),
  wash: className("wash")
})

export const neutralToneClasses: ToneClasses = slotClasses(neutralSlotClassName)

export const toneClassesFor = (tone: CardTone): ToneClasses => slotClasses((slot) => toneSlotClassName(tone, slot))

export const toneClassesForCard = (id: CardId): ToneClasses => toneClassesFor(toneForCard(id))

/** Every class a set of tone classes may wear, one per slot, for the generator to declare. */
export const toneClassCandidates = (classes: ToneClasses): ReadonlyArray<string> =>
  Arr.map(ToneSlot.literals, (slot) => classes[slot])

// ---------------------------------------------------------------------------
// Discs — what a disc of the imagined place wears in its contributor's tone.
// ---------------------------------------------------------------------------

const discSlotUtility = (slot: DiscSlot): string =>
  Match.value(slot).pipe(
    Match.when("ring", () => "ring"),
    Match.when("actOutline", () => "outline"),
    Match.when("focusRing", () => "data-[place-focused]:ring"),
    Match.when("ghost", () => "border"),
    Match.whenOr("bandArrivingStroke", "bandStroke", "bandFocusedStroke", () => "stroke"),
    Match.when("bandFill", () => "fill"),
    Match.exhaustive
  )

/** A disc's ring, act outline and ghost let the disc's own fill through; the band's flat paint is solid. */
const discSlotAlpha = (slot: DiscSlot): string =>
  Match.value(slot).pipe(
    Match.when("ring", () => "/60"),
    Match.when("actOutline", () => "/70"),
    Match.when("ghost", () => "/80"),
    Match.whenOr("focusRing", "bandArrivingStroke", "bandFill", "bandStroke", "bandFocusedStroke", () => ""),
    Match.exhaustive
  )

export const discSlotClassName = (tone: CardTone, slot: DiscSlot): string =>
  `${discSlotUtility(slot)}-${toneColorName(tone, discSlotRole(slot))}${discSlotAlpha(slot)}`

/** The disc's soft radial fill in its tone: a utility the generated stylesheet declares per tone. */
export const discFillClassName = (tone: CardTone): string => `bg-place-disc-${tone}`

// ---------------------------------------------------------------------------
// Surfaces — the three things a surface can be, and how each is drawn.
// The canvas is the page: content sits on it with no border, radius or shadow.
// ---------------------------------------------------------------------------

export const surfaceClassName = (role: SurfaceRole): string =>
  Match.value(role).pipe(
    Match.when("canvas", () => ""),
    Match.when("instrument", () => "rounded-instrument bg-instrument"),
    Match.when("overlay", () => "rounded-instrument bg-paper shadow-surface"),
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

/**
 * A control that keeps an outline of its own (the discs) and has nothing to
 * say with it draws it transparent, so only its colour ever transitions.
 * Forced colours repaint transparent in `CanvasText`, which would light every
 * silent control: there the silent outline is no outline. The two words that
 * bring it back — focus, and answering — each say `outline-solid` again.
 */
export const silentOutlineClassName = "outline-transparent forced-colors:outline-none"

/**
 * A control that says it is answering — open, or answered for — with a ring
 * says it under forced colours with its outline in `Highlight`, since the
 * ring is a shadow and dropped there. For a control that keeps an outline of
 * its own (the discs), whose colour is otherwise forced to `CanvasText` and
 * whose silent outline is none.
 */
export const forcedColorsAnsweringOutlineClassName =
  "forced-colors:data-[popup-open]:outline-solid forced-colors:data-[popup-open]:outline-[Highlight] forced-colors:data-[place-focused]:outline-solid forced-colors:data-[place-focused]:outline-[Highlight]"

/** A mark's box: pointable and focusable. The wash is added by whichever box wears it. */
export const markClassName =
  `group/mark cursor-default rounded-md transition-colors duration-150 ease-theme ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink/20 ${stillUnderReducedMotion}`

/** The wash on a mark's own box. */
export const litMarkClassName =
  "hover:bg-instrument/80 data-[place-focused]:bg-instrument/80 data-[popup-open]:bg-instrument/80 forced-colors:hover:bg-[Highlight] forced-colors:hover:text-[HighlightText] forced-colors:data-[place-focused]:bg-[Highlight] forced-colors:data-[place-focused]:text-[HighlightText] forced-colors:data-[popup-open]:bg-[Highlight] forced-colors:data-[popup-open]:text-[HighlightText]"

/** The wash on a chip set inside a mark, in place of the chip's own paper. */
export const litChipClassName =
  `transition-colors duration-150 ease-theme ${stillUnderReducedMotion} group-hover/mark:bg-instrument/80 group-data-[place-focused]/mark:bg-instrument/80 group-data-[popup-open]/mark:bg-instrument/80 forced-colors:group-hover/mark:bg-[Highlight] forced-colors:group-hover/mark:text-[HighlightText] forced-colors:group-data-[place-focused]/mark:bg-[Highlight] forced-colors:group-data-[place-focused]/mark:text-[HighlightText] forced-colors:group-data-[popup-open]/mark:bg-[Highlight] forced-colors:group-data-[popup-open]/mark:text-[HighlightText]`

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

export const dangerStatusTone: InlineStatusTone = { dot: "bg-danger-accent", text: "text-danger-ink" }

const pillButtonBaseClassName =
  `inline-flex min-h-9 items-center justify-center rounded-full border px-4 py-2 transition-colors duration-150 ease-out ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55`

export const pillButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: ToneClasses
}): string =>
  Bool.match(active, {
    onTrue: () => `${pillButtonBaseClassName} ${tone.borderSubtle} ${tone.bgTinted}`,
    onFalse: () => `${pillButtonBaseClassName} border-transparent bg-instrument/70 hover:bg-instrument`
  })

const segmentedControlRailBaseClassName =
  "grid min-w-0 gap-1 rounded-instrument border border-hairline bg-instrument p-1"

/**
 * A segmented control is one row of equal cells at every width the cells can
 * hold: up to three stay side by side on a phone; four fold to two rows below
 * the small breakpoint.
 */
export const segmentedControlRailClassName = (count: number): string =>
  Match.value(count).pipe(
    Match.when(Num.lessThanOrEqualTo(2), () => `${segmentedControlRailBaseClassName} grid-cols-2`),
    Match.when(3, () => `${segmentedControlRailBaseClassName} grid-cols-3`),
    Match.orElse(() => `${segmentedControlRailBaseClassName} grid-cols-2 sm:grid-cols-4`)
  )

const segmentedControlButtonBaseClassName =
  `inline-flex min-h-10 min-w-0 items-center justify-center rounded-control border border-transparent px-3 py-2 transition-colors duration-150 ease-out ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55`

export const segmentedControlButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: ToneClasses
}): string =>
  Bool.match(active, {
    onTrue: () => `${segmentedControlButtonBaseClassName} border-hairline bg-paper ${tone.bgTinted}`,
    onFalse: () => `${segmentedControlButtonBaseClassName} hover:bg-paper/60`
  })

const toggleTrackBaseClassName =
  `inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150 ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55 forced-colors:border-[CanvasText]`

export const toggleTrackClassName = ({
  checked,
  tone
}: {
  readonly checked: boolean
  readonly tone: ToneClasses
}): string =>
  Bool.match(checked, {
    onTrue: () =>
      `${toggleTrackBaseClassName} ${tone.border} ${tone.bg} ${tone.focusRing} forced-colors:bg-[Highlight]`,
    onFalse: () => `${toggleTrackBaseClassName} border-hairline/90 bg-canvas/90 ${tone.focusRing}`
  })

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
    "relative min-h-screen overflow-x-clip font-body text-ink antialiased selection:bg-tone-text-wash/60 selection:text-ink-strong",
  content: "relative mx-auto flex w-full max-w-[88rem] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12"
}
