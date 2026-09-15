import { Match, Schema } from "effect"

import { classNames } from "./classNames.js"
import { elevationClassName, focusClassName, respondColorsClassName } from "./designSystem.js"

/**
 * What a page's header is. The home page's floats: the wordmark and three
 * ways off the page set on the canvas, scrolling away with it, so the first
 * thing the page says is that it is not a card. The documentation's is a
 * workbench's: pinned over everything the page scrolls, on a veil of the
 * canvas that blurs what passes under it, with a hairline beneath. Both are
 * the one header; this is the difference between a story and a workbench,
 * not drift.
 */
export const HeaderChrome = Schema.Literal("floating", "workbench")
export type HeaderChrome = typeof HeaderChrome.Type

export const headerChromeClassName = (chrome: HeaderChrome): string =>
  Match.value(chrome).pipe(
    Match.when("floating", () => "pb-2 pt-2"),
    Match.when(
      "workbench",
      () => `sticky top-0 ${elevationClassName("header")} border-b border-hairline-veil bg-canvas-veil backdrop-blur-xl`
    ),
    Match.exhaustive
  )

const headerChromeFocusClassName = `${focusClassName} focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`

/**
 * What every header control is: ink that darkens under the pointer, nothing
 * drawn around it, and the same small room around its glyph and words, so
 * the space between two controls is the header's one gap as the reader sees
 * it. A press reaches further than the room shows: a box before the control,
 * centred on it and never narrower than 44px, takes the press for it, so a
 * glyph alone is as easy to hit as a word without standing further from its
 * neighbours.
 */
const headerChromeControlClassName =
  `relative inline-flex min-h-11 items-center gap-2 rounded-control px-1.5 text-ink-secondary ${respondColorsClassName} hover:text-ink-strong before:absolute before:inset-y-0 before:left-1/2 before:w-[max(100%,2.75rem)] before:-translate-x-1/2`

/**
 * The ink of every header glyph — the part of it that is drawn — is one
 * size, whether the glyph stands beside words or alone. The control sets it
 * as a variable so its glyph can be sized from it.
 */
const headerChromeGlyphInkClassName = "[--header-chrome-glyph-ink:1rem]"

/** A header destination as words beside a glyph. */
export const headerChromeLinkClassName = (className = ""): string =>
  classNames(headerChromeControlClassName, headerChromeGlyphInkClassName, headerChromeFocusClassName, className)

/** A header control that is only its glyph: the same ink, the same hover, the same room and reach. */
export const headerChromeIconButtonClassName = (className = ""): string =>
  classNames(
    headerChromeControlClassName,
    "justify-center",
    headerChromeGlyphInkClassName,
    headerChromeFocusClassName,
    className
  )

/**
 * Where a header glyph is drawn from, which decides how much of its box its
 * ink nominally fills. Heroicons' 20-unit solid set draws on a 16-unit grid
 * inside a two-unit margin — the sun fills the 16 exactly, the open book
 * spans it at its widest, the moon runs a little past it — so its ink is
 * taken as four fifths of the box; a brand mark such as GitHub's fills its
 * box to the edge. A glyph's box is its ink size divided by that fraction,
 * so glyphs from either source are drawn at nominally the same size.
 */
export const HeaderGlyphSource = Schema.Literal("heroicon-20-solid", "brand-mark")
export type HeaderGlyphSource = typeof HeaderGlyphSource.Type

/**
 * A glyph inside a header control, boxed so its ink is the control's glyph
 * ink size, and taking only its ink's width in the line: the margin a set
 * leaves inside its box is pulled back out, so the room beside a glyph is
 * the control's room, not the control's room plus the set's.
 */
export const headerChromeGlyphClassName = (source: HeaderGlyphSource): string =>
  Match.value(source).pipe(
    Match.when(
      "heroicon-20-solid",
      () => "size-[calc(var(--header-chrome-glyph-ink)*1.25)] -mx-[calc(var(--header-chrome-glyph-ink)*0.125)] shrink-0"
    ),
    Match.when("brand-mark", () => "size-(--header-chrome-glyph-ink) shrink-0"),
    Match.exhaustive
  )
