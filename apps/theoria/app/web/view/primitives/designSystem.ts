import { Boolean as Bool, Match, Number as Num, Schema } from "effect"
import * as Arr from "effect/Array"

import type { Elevation, Measure, SurfaceRole } from "../../../contracts/layout.js"
import { motionEaseFor, type MotionRelation } from "../../../contracts/motion.js"
import {
  type DiscSlot,
  discSlotRole,
  discSlotTranslucency,
  type NeutralRole,
  neutralSlotRole,
  type ToneRole,
  ToneSlot,
  toneSlotRole,
  toneSlotTranslucency,
  type Translucency
} from "../../../contracts/palette.js"
import type { Tone } from "../../../contracts/theme.js"

// ---------------------------------------------------------------------------
// ToneClasses — the class a component's slot wears in a tone, derived from the
// palette contract: the slot says which role it reads (`toneSlotRole`), and
// this file says which utility paints it. Tailwind cannot see a class composed
// here, so the palette generator declares every one as a candidate
// (`@source inline`) in the generated stylesheet; a contract test holds that.
// ---------------------------------------------------------------------------

/** The utility a slot is worn as: the property it paints, under the state it answers to. */
const slotUtility = (slot: ToneSlot): string =>
  Match.value(slot).pipe(
    Match.whenOr("border", "borderSubtle", () => "border"),
    Match.when("borderHover", () => "hover:border"),
    Match.whenOr("dot", "bg", "bgTinted", "wash", () => "bg"),
    Match.whenOr("bgHover", "bgTintedHover", () => "hover:bg"),
    Match.whenOr("text", "textStrong", () => "text"),
    Match.when("stroke", () => "stroke"),
    Match.exhaustive
  )

/** A translucency's suffix on a colour name: a solid colour is the role itself, `paper`; a translucent one is `paper-veil`. */
const translucencySuffix = (translucency: Translucency): string =>
  Match.value(translucency).pipe(
    Match.when("solid", () => ""),
    Match.whenOr("veil", "glass", "mist", (level) => `-${level}`),
    Match.exhaustive
  )

/** The name Tailwind knows a neutral role by at a translucency, as the generated bridge declares it. */
export const neutralColorName = (role: NeutralRole, translucency: Translucency): string =>
  `${role}${translucencySuffix(translucency)}`

/** The name Tailwind knows a tone's role by at a translucency, as the generated bridge declares it. */
export const toneColorName = (tone: Tone, role: ToneRole, translucency: Translucency): string =>
  `tone-${tone}-${role}${translucencySuffix(translucency)}`

const toneSlotClassName = (tone: Tone, slot: ToneSlot): string =>
  `${slotUtility(slot)}-${toneColorName(tone, toneSlotRole(slot), toneSlotTranslucency(slot))}`

const neutralSlotClassName = (slot: ToneSlot): string =>
  `${slotUtility(slot)}-${neutralColorName(neutralSlotRole(slot), toneSlotTranslucency(slot))}`

export const ToneClasses = Schema.Record({ key: ToneSlot, value: Schema.String })
export type ToneClasses = typeof ToneClasses.Type

const slotClasses = (className: (slot: ToneSlot) => string): ToneClasses => ({
  border: className("border"),
  borderHover: className("borderHover"),
  borderSubtle: className("borderSubtle"),
  dot: className("dot"),
  text: className("text"),
  textStrong: className("textStrong"),
  stroke: className("stroke"),
  bg: className("bg"),
  bgHover: className("bgHover"),
  bgTinted: className("bgTinted"),
  bgTintedHover: className("bgTintedHover"),
  wash: className("wash")
})

export const neutralToneClasses: ToneClasses = slotClasses(neutralSlotClassName)

export const toneClassesFor = (tone: Tone): ToneClasses => slotClasses((slot) => toneSlotClassName(tone, slot))

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

export const discSlotClassName = (tone: Tone, slot: DiscSlot): string =>
  `${discSlotUtility(slot)}-${toneColorName(tone, discSlotRole(slot), discSlotTranslucency(slot))}`

/** The disc's soft radial fill in its tone: a utility the generated stylesheet declares per tone. */
export const discFillClassName = (tone: Tone): string => `bg-place-disc-${tone}`

// ---------------------------------------------------------------------------
// Motion — a CSS transition's duration and ease are the motion contract's:
// `transitionClassName` reads the relation's tokens from the generated
// stylesheet, and nothing else in the views names a duration or an ease (a
// lint rule holds that). CSS transitions do not read Motion's configuration,
// so a thing that travels by transition (a translate, a scale, a height, a
// rotation) says here that it stands still when the reader asks for reduced
// motion. Motion's own values are configured from the same preference at the
// root; this is the CSS side of one rule.
// ---------------------------------------------------------------------------

/** How long a transition takes and how it moves: the relation's duration token and its ease. */
export const transitionClassName = (relation: MotionRelation): string =>
  `duration-(--th-motion-duration-${relation}) ease-${motionEaseFor(relation)}`

/** A transitioned thing that travels; under reduced motion it takes its place at once. */
export const stillUnderReducedMotion = "motion-reduce:transition-none"

/** A control's colours answering the pointer or the focus. */
export const respondColorsClassName = `transition-colors ${transitionClassName("respond")}`

// ---------------------------------------------------------------------------
// Surfaces — the five things a surface can be, and how each is drawn. The
// canvas is the page: content sits on it with no border, radius or shadow.
// Every sheet, drawer and overlay on the page is composed here and nowhere else.
// ---------------------------------------------------------------------------

export const surfaceClassName = (role: SurfaceRole): string =>
  Match.value(role).pipe(
    Match.when("canvas", () => ""),
    Match.when("instrument", () => "rounded-instrument bg-instrument"),
    Match.when("overlay", () => "rounded-instrument bg-paper shadow-surface"),
    Match.when("sheet", () => "rounded-sheet border border-hairline-strong-veil bg-paper shadow-hero"),
    Match.when("drawer", () => "border-r border-hairline-strong-veil bg-paper shadow-hero"),
    Match.exhaustive
  )

/** A notice set into the reading: an instrument's fill with a firm edge, its words in the ink. Colour says who, and a notice is no one, so it is neutral. */
export const noticeClassName = `${surfaceClassName("instrument")} border border-hairline-strong-glass px-4 py-3`

/** How high a thing stands over the page: the elevation's z-index token, in the one order `Elevation` gives. */
export const elevationClassName = (elevation: Elevation): string => `z-(--th-z-${elevation})`

/** How wide a column of content may be: the measure's container token. */
export const measureClassName = (measure: Measure): string => `max-w-${measure}`

// ---------------------------------------------------------------------------
// Focus — one ring for every focused control, in the neutral `focus` role,
// whatever the control's tone: focus is an affordance, not a brand accent.
// ---------------------------------------------------------------------------

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
 * The ring itself: two pixels of the focus role, hugging the control's own
 * edge. Worn with `focusEdgeClassName`, which gives up the outline for it. A
 * ring set off from its control is a gap painted in a colour, and the browser's
 * colour for that gap is white; so a control that wants the gap — words in
 * the header, a disc on the stage — names the ground it stands on for it, and
 * a control with an edge of its own wears the ring against that edge.
 */
export const focusRingClassName = "focus-visible:ring-2 focus-visible:ring-focus"

/** A control's focus in one word: the edge given up and the ring worn. */
export const focusClassName = `${focusEdgeClassName} ${focusRingClassName}`

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

// ---------------------------------------------------------------------------
// The pointer — how a thing at rest answers it. One direction everywhere:
// under the pointer a control steps toward the ink, and a press steps it once
// more, each a step along the neutral ladder and never toward the paper, so a
// hovered thing is never lighter than its neighbours and never mistaken for
// one that is chosen. On paper or the canvas the steps are a glass of the
// instrument and the instrument; on an instrument rail, where the instrument
// is the ground and a glass of the next rung would not show against it, they
// are the hairline and the strong hairline, solid. Text
// answers with the underline every link in the prose already wears — the
// accent's rule under the words — and never a lighter ink, so words under
// the pointer read firmer, not fainter.
// ---------------------------------------------------------------------------

/** A control at rest on paper or the canvas, under the pointer and pressed. */
export const firmUnderPointerClassName = "hover:bg-instrument-glass active:bg-instrument"

/** A control at rest on an instrument rail, under the pointer and pressed. */
export const firmOnRailUnderPointerClassName = "hover:bg-hairline active:bg-hairline-strong"

/** The rule under a link's words: the accent, set off the baseline. */
const linkRuleClassName = "decoration-accent underline-offset-4"

/** Words that are always a link: the rule under them at rest, the words firming under the pointer. */
export const linkTextClassName = `underline ${linkRuleClassName} hover:text-ink-strong`

/** A title that is a link: it takes the rule when its card (`group`) is under the pointer. */
export const linkTitleClassName = `group-hover:underline ${linkRuleClassName}`

/** A heading that links to itself: the rule appears under the pointer. */
export const anchorHeadingClassName = `hover:underline ${linkRuleClassName}`

// ---------------------------------------------------------------------------
// Marks — a thing on the page that can be pointed at and answered. Wherever a
// mark stands — in a line of text, in the code's gutter, on the paper, as a
// value under a line of code — it is lit the same way: a glass of the
// instrument under the pointer, and the instrument itself while it is
// answered — whether pointed at itself or lit by the answer to another — so
// the answer reads firmer than the pointer passing over. A mark is
// `group/mark`, so a chip set inside it can wear the wash on its own box
// instead of the mark's.
// ---------------------------------------------------------------------------

/** A mark's box: pointable and focusable. The wash is added by whichever box wears it. */
export const markClassName =
  `group/mark rounded-mark ${respondColorsClassName} ${focusClassName} ${stillUnderReducedMotion}`

/** The wash on a mark's own box. */
export const litMarkClassName =
  "hover:bg-instrument-glass data-[place-focused]:bg-instrument data-[popup-open]:bg-instrument forced-colors:hover:bg-[Highlight] forced-colors:hover:text-[HighlightText] forced-colors:data-[place-focused]:bg-[Highlight] forced-colors:data-[place-focused]:text-[HighlightText] forced-colors:data-[popup-open]:bg-[Highlight] forced-colors:data-[popup-open]:text-[HighlightText]"

/** The wash on a chip set inside a mark, in place of the chip's own paper. */
export const litChipClassName =
  `${respondColorsClassName} ${stillUnderReducedMotion} group-hover/mark:bg-instrument-glass group-data-[place-focused]/mark:bg-instrument group-data-[popup-open]/mark:bg-instrument forced-colors:group-hover/mark:bg-[Highlight] forced-colors:group-hover/mark:text-[HighlightText] forced-colors:group-data-[place-focused]/mark:bg-[Highlight] forced-colors:group-data-[place-focused]/mark:text-[HighlightText] forced-colors:group-data-[popup-open]/mark:bg-[Highlight] forced-colors:group-data-[popup-open]/mark:text-[HighlightText]`

// ---------------------------------------------------------------------------
// InlineStatusTone — a glyph and a colour for a status said in the text's own
// line: a dot in the tone and the words after it. Never a capsule.
// ---------------------------------------------------------------------------

export const InlineStatusTone = Schema.Struct({
  dot: Schema.String,
  text: Schema.String
})
export type InlineStatusTone = typeof InlineStatusTone.Type

export const inlineStatusToneFor = (tone: Tone): InlineStatusTone => {
  const classes = toneClassesFor(tone)
  return { dot: classes.dot, text: classes.text }
}

export const neutralStatusTone: InlineStatusTone = { dot: neutralToneClasses.dot, text: neutralToneClasses.text }

export const dangerStatusTone: InlineStatusTone = { dot: "bg-danger-accent", text: "text-danger-ink" }

// ---------------------------------------------------------------------------
// Controls — pills, segmented controls, toggles, actions. Every control
// answers each state it can be in with a step of its own: at rest, under the
// pointer, pressed, chosen (and chosen under the pointer), disabled. A chosen
// control is in its tone; the pointer over it deepens the tone. A control at
// rest is neutral; the pointer over it firms its paper, and a press firms it
// once more — each a step along the neutral ladder, never a colour of its own.
// ---------------------------------------------------------------------------

const pillButtonBaseClassName =
  `inline-flex min-h-9 items-center justify-center rounded-full border px-4 py-2 ${respondColorsClassName} ${focusClassName} disabled:cursor-not-allowed disabled:opacity-55`

export const pillButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: ToneClasses
}): string =>
  Bool.match(active, {
    onTrue: () => `${pillButtonBaseClassName} ${tone.borderSubtle} ${tone.bgTinted} ${tone.bgTintedHover}`,
    onFalse: () =>
      `${pillButtonBaseClassName} border-transparent bg-instrument-glass hover:bg-instrument active:bg-hairline`
  })

const segmentedControlRailBaseClassName = `grid min-w-0 gap-1 ${
  surfaceClassName("instrument")
} border border-hairline p-1`

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
  `inline-flex min-h-10 min-w-0 items-center justify-center rounded-control border border-transparent px-3 py-2 ${respondColorsClassName} ${focusClassName} disabled:cursor-not-allowed disabled:opacity-55`

export const segmentedControlButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: ToneClasses
}): string =>
  Bool.match(active, {
    onTrue: () => `${segmentedControlButtonBaseClassName} ${tone.borderSubtle} ${tone.bgTinted} ${tone.bgTintedHover}`,
    onFalse: () => `${segmentedControlButtonBaseClassName} ${firmOnRailUnderPointerClassName}`
  })

const toggleTrackBaseClassName =
  `inline-flex h-7 w-12 shrink-0 items-center rounded-full border ${respondColorsClassName} ${focusClassName} disabled:cursor-not-allowed disabled:opacity-55 forced-colors:border-[CanvasText]`

export const toggleTrackClassName = ({
  checked,
  tone
}: {
  readonly checked: boolean
  readonly tone: ToneClasses
}): string =>
  Bool.match(checked, {
    onTrue: () =>
      `${toggleTrackBaseClassName} ${tone.border} ${tone.bg} ${tone.borderHover} ${tone.bgHover} forced-colors:bg-[Highlight] forced-colors:hover:bg-[Highlight]`,
    onFalse: () =>
      `${toggleTrackBaseClassName} border-hairline-veil bg-canvas-veil hover:border-hairline-strong hover:bg-instrument`
  })

/** A filled action: emphasis under its words, a step off under the pointer, another while pressed. */
export const primaryActionClassName =
  "border-emphasis bg-emphasis text-on-emphasis shadow-chip hover:border-emphasis-hover hover:bg-emphasis-hover active:border-emphasis-pressed active:bg-emphasis-pressed"

/** An action on paper: a firm edge that darkens under the pointer, paper that settles solid and firms to the instrument while pressed. */
export const secondaryActionClassName =
  "border-hairline-strong-veil bg-paper-veil text-ink shadow-chip hover:border-accent hover:bg-paper active:bg-instrument"

/** A glyph alone as a control on paper, in the header or a sheet. */
export const iconButtonClassName =
  `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-instrument border border-hairline-veil bg-paper-glass text-ink-secondary transition-[border-color,background-color,color] ${
    transitionClassName("respond")
  } hover:border-hairline-strong hover:bg-paper-veil hover:text-ink active:bg-instrument ${focusClassName}`

/** The control that opens a search or a picker: a field's height, paper that firms under the pointer. */
export const pickerTriggerClassName =
  `flex h-11 min-w-0 items-center gap-2.5 rounded-instrument border border-hairline-veil bg-paper-glass px-3 text-ink-tertiary shadow-chip transition-[border-color,background-color,color] ${
    transitionClassName("respond")
  } hover:border-hairline-strong hover:bg-paper-veil hover:text-ink active:bg-instrument ${focusClassName}`

// ---------------------------------------------------------------------------
// Sheets, drawers and their backdrops — surfaces over the page, each at its
// elevation, arriving and leaving by the relation that fits.
// ---------------------------------------------------------------------------

/** The dim over the page under a sheet: fades in and out with the sheet. */
export const dialogBackdropClassName = `fixed inset-0 ${
  elevationClassName("backdrop")
} bg-ink-strong-mist backdrop-blur-sm transition-opacity ${
  transitionClassName("enter")
} data-[starting-style]:opacity-0 data-[ending-style]:opacity-0`

export const dialogViewportClassName = `fixed inset-0 ${
  elevationClassName("sheet")
} flex items-start justify-center overflow-y-auto px-3 py-[10dvh] sm:px-6`

/** A sheet that arrives from just above its place and leaves the same way. */
export const dialogSheetClassName = `overflow-hidden ${surfaceClassName("sheet")} transition-[opacity,transform] ${
  transitionClassName("enter")
} data-[starting-style]:translate-y-[-0.5rem] data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:translate-y-[-0.5rem] data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 ${stillUnderReducedMotion}`

/**
 * The drawer follows the finger while swiped (`duration-0`), and when let go
 * settles by the `follow` relation, shortened by how far the swipe had
 * already carried it.
 */
const drawerSettleClassName = `${
  transitionClassName("follow")
} data-[swiping]:duration-0 data-[ending-style]:duration-[calc(var(--drawer-swipe-strength)*var(--th-motion-duration-follow))]`

export const drawerBackdropClassName = `fixed inset-0 ${
  elevationClassName("backdrop")
} min-h-dvh bg-ink-strong backdrop-blur-sm opacity-[calc(0.25*(1-var(--drawer-swipe-progress)))] transition-opacity ${drawerSettleClassName} data-[starting-style]:opacity-0 data-[ending-style]:opacity-0`

export const drawerViewportClassName = `fixed inset-0 ${elevationClassName("sheet")} flex justify-start`

export const drawerClassName =
  `h-full w-[min(22rem,88vw)] translate-x-[var(--drawer-swipe-movement-x)] touch-auto overflow-y-auto overscroll-contain ${
    surfaceClassName("drawer")
  } ${focusEdgeClassName} transition-transform ${drawerSettleClassName} will-change-transform data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full data-[swiping]:select-none ${stillUnderReducedMotion}`

/** A menu opened from the header: an overlay at the menu's elevation, scaling in from its anchor. */
export const menuPopupClassName = `origin-[var(--transform-origin)] overflow-y-auto overscroll-contain ${
  surfaceClassName("overlay")
} border border-hairline-strong-veil p-2 transition-[opacity,transform] ${
  transitionClassName("enter")
} data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 ${stillUnderReducedMotion}`

export const menuItemClassName =
  `flex min-w-0 items-center gap-3 rounded-instrument px-3 py-2.5 text-ink-secondary ${focusEdgeClassName} ${firmUnderPointerClassName} focus:bg-instrument-glass`

/** A code example's frame: a sheet that clips its lines. */
export const codeFrameClassName = `overflow-hidden ${surfaceClassName("sheet")}`

export const codeActionClassName =
  `inline-flex min-h-10 items-center gap-1.5 rounded-control bg-transparent px-3 text-ink-tertiary ${respondColorsClassName} ${firmUnderPointerClassName} hover:text-ink ${focusClassName}`

// ---------------------------------------------------------------------------
// The workbench — the documentation's grid: a navigation rail, the reading
// column, and the page's outline, under the sticky header.
// ---------------------------------------------------------------------------

const workbenchNavLinkBaseClassName =
  `group relative flex min-w-0 items-start ${focusClassName} transition-[border-color,background-color,color] ${
    transitionClassName("respond")
  } hover:text-ink`

/**
 * A link in the navigation rail: a section at rest or chosen, or a page under
 * a section. At rest the pointer lays a glass of paper over it; chosen, it
 * stands on a veil of paper already, and the pointer settles that solid — a
 * step firmer, never a step back.
 */
export const workbenchNavLinkClassName = ({
  active,
  child
}: {
  readonly active: boolean
  readonly child: boolean
}): string =>
  Bool.match(child, {
    onTrue: () =>
      `${workbenchNavLinkBaseClassName} rounded-control px-3 py-2 text-ink-tertiary ${
        Bool.match(active, {
          onTrue: () =>
            "bg-paper-veil text-ink-strong hover:bg-paper before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-ink-secondary",
          onFalse: () => "hover:bg-paper-glass"
        })
      }`,
    onFalse: () =>
      `${workbenchNavLinkBaseClassName} gap-3 rounded-instrument border border-transparent px-3 py-2.5 text-ink-secondary ${
        Bool.match(active, {
          onTrue: () =>
            "border-hairline-strong-veil bg-paper-veil text-ink-strong shadow-chip hover:border-hairline-strong hover:bg-paper before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-0.5 before:rounded-full before:bg-ink-secondary",
          onFalse: () => "hover:border-hairline-veil hover:bg-paper-glass"
        })
      }`
  })

/** The workbench meets the viewport; its brand, index heading and sidebar controls share one inset. */
const workbenchInsetClassName = "px-4 sm:px-6"

export const workbenchTheme = {
  headerContent: `flex min-h-[4.5rem] w-full items-center justify-between gap-3 ${workbenchInsetClassName}`,
  index: `w-full py-8 sm:py-10 ${workbenchInsetClassName}`,
  grid:
    "relative grid w-full grid-cols-1 lg:grid-cols-[17.5rem_minmax(0,1fr)] xl:grid-cols-[17.5rem_minmax(0,1fr)_13rem]",
  sidebar:
    `hidden min-w-0 border-r border-hairline-glass bg-canvas-glass py-7 lg:block lg:min-h-[calc(100dvh-4.5rem)] ${workbenchInsetClassName}`,
  sidebarSticky: "sticky top-[6.25rem] max-h-[calc(100dvh-7.75rem)] gap-6 overflow-y-auto pr-1",
  main: "min-w-0 px-4 py-8 sm:px-7 sm:py-10 lg:px-10 xl:px-12",
  /** The landmark focus moves to after navigation: unmarked, except where forced colours must show where focus went. */
  routeFocus: focusEdgeClassName,
  article: `w-full ${measureClassName("reading")}`,
  toc: "hidden min-w-0 px-5 py-8 xl:block",
  tocSticky: "sticky top-[6.25rem] max-h-[calc(100dvh-7.75rem)] overflow-y-auto pr-1"
}

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
    "relative min-h-screen overflow-x-clip font-body text-ink antialiased selection:bg-tone-primary-wash selection:text-ink-strong",
  content: `relative mx-auto flex w-full ${measureClassName("page")} flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12`
}
