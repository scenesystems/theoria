import { headerChromeButtonClassName } from "./HeaderChrome.js"

export const chromeHeaderGlyphClassName =
  "h-[var(--header-chrome-glyph-size)] w-[var(--header-chrome-glyph-size)] shrink-0"

export const chromeIconButtonClassName = ({
  active,
  className
}: {
  readonly active: boolean
  readonly className?: string
}): string => headerChromeButtonClassName({ active, className })
