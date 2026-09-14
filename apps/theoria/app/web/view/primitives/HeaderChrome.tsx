import { classNames } from "./classNames.js"
import { focusEdgeClassName } from "./designSystem.js"

const headerChromeFocusClassName =
  `${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-2 focus-visible:ring-offset-stage-50`

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
  "relative inline-flex min-h-11 items-center gap-2 rounded-control px-1.5 text-ink-700 transition-colors duration-150 hover:text-ink-950 before:absolute before:inset-y-0 before:left-1/2 before:w-[max(100%,2.75rem)] before:-translate-x-1/2"

/**
 * A header destination as words beside a glyph. The glyph size is a variable
 * so a mark beside the words sits at the same height in every header control.
 */
export const headerChromeLinkClassName = (className = ""): string =>
  classNames(
    headerChromeControlClassName,
    "[--header-chrome-glyph-size:1rem]",
    headerChromeFocusClassName,
    className
  )

/** A header control that is only its glyph: the same ink, the same hover, the same room and reach. */
export const headerChromeIconButtonClassName = (className = ""): string =>
  classNames(
    headerChromeControlClassName,
    "justify-center [--header-chrome-glyph-size:1.125rem]",
    headerChromeFocusClassName,
    className
  )

/** A glyph inside a header control, sized by the control. */
export const headerChromeGlyphClassName =
  "h-[var(--header-chrome-glyph-size)] w-[var(--header-chrome-glyph-size)] shrink-0"
