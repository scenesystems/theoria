import { classNames } from "./classNames.js"
import { focusEdgeClassName } from "./designSystem.js"

const headerChromeFocusClassName =
  `${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-2 focus-visible:ring-offset-stage-50`

/**
 * A header destination as words: ink that darkens under the pointer, nothing
 * drawn around it. The glyph size is a variable so a mark beside the words
 * sits at the same height in every header control.
 */
export const headerChromeLinkClassName = (className = ""): string =>
  classNames(
    "inline-flex min-h-11 items-center gap-2 rounded-control px-1.5 text-ink-700 transition-colors duration-150 hover:text-ink-950 [--header-chrome-glyph-size:1rem]",
    headerChromeFocusClassName,
    className
  )

/** A header control that is only its glyph: the same ink and the same hover, in a square hit area. */
export const headerChromeIconButtonClassName = (className = ""): string =>
  classNames(
    "inline-flex size-11 items-center justify-center rounded-control text-ink-700 transition-colors duration-150 hover:text-ink-950 [--header-chrome-glyph-size:1.125rem]",
    headerChromeFocusClassName,
    className
  )

/** A glyph inside a header control, sized by the control. */
export const headerChromeGlyphClassName =
  "h-[var(--header-chrome-glyph-size)] w-[var(--header-chrome-glyph-size)] shrink-0"
