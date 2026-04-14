import { Match } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import type { PaneScroll } from "../../../contracts/presentation/layout.js"

const scrollClassName = (scroll: PaneScroll): string =>
  Match.value(scroll).pipe(
    Match.when("vertical", () => "overflow-x-hidden overflow-y-auto"),
    Match.when("horizontal", () => "overflow-x-auto overflow-y-hidden"),
    Match.when("both", () => "overflow-auto"),
    Match.orElse(() => "overflow-hidden")
  )

/**
 * Scrollable content pane within a `Grid`. Overflow and scroll behavior
 * are driven by `PaneScroll` schema values via Tailwind utilities.
 *
 * @since 0.1.0
 */
export const Pane = ({
  children,
  className,
  scroll,
  sticky
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly scroll: PaneScroll
  readonly sticky?: boolean
}) => {
  const base = scrollClassName(scroll)
  const stickyClass = sticky === true ? "xl:sticky xl:top-0 xl:self-start" : ""
  const parts: ReadonlyArray<string> = [base, stickyClass, className ?? ""]
  const combined = Arr.join(Arr.filter(parts, (s) => s.length > 0), " ")

  return <div className={combined}>{children}</div>
}
