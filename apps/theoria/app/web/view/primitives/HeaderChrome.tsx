import { classNames } from "./classNames.js"
import { Layer } from "./Layout.js"

export const headerChromeSurfaceClassName = "border border-stage-200/88 bg-stage-0/78 backdrop-blur-md"

export const headerChromeRailClassName = (className = ""): string =>
  classNames(
    "inline-flex min-w-0 flex-nowrap items-center rounded-[1.7rem] px-2 py-1.5",
    headerChromeSurfaceClassName,
    className
  )

export const headerChromeButtonClassName = ({
  active,
  className = ""
}: {
  readonly active: boolean
  readonly className?: string
}): string =>
  classNames(
    "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[1rem] border px-4 text-ink-700 transition-[border-color,background-color,color] duration-150 [--header-chrome-glyph-size:0.875rem] md:[--header-chrome-glyph-size:0.9375rem]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1",
    active
      ? "border-stage-300/92 bg-stage-50/78 text-ink-900"
      : "border-stage-200/82 bg-transparent hover:border-stage-300/88 hover:bg-stage-50/68 hover:text-ink-900",
    className
  )

export const headerChromeActionClassName = (className: string): string =>
  classNames("h-11 rounded-[1rem] px-4 shadow-none", className)

export const HeaderChromeDivider = ({ className = "" }: { readonly className?: string }) => (
  <Layer aria-hidden className={classNames("h-7 w-px bg-stage-200/80", className)} />
)
