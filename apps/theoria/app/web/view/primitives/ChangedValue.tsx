import type { ReactNode } from "react"

import { Layer } from "./Layout.js"

/**
 * Wraps a value that should be seen to change. `changes` counts how often the
 * value has changed since it first appeared; each increment remounts the
 * wrapper, which replays a one-shot wash. Zero is the first appearance and
 * gets no wash, so nothing lights up on first paint.
 */
export const ChangedValue = ({ changes, children, className }: {
  readonly changes: number
  readonly children: ReactNode
  readonly className?: string
}) => (
  <Layer
    className={`${changes > 0 ? "animate-value-changed" : ""} ${className ?? ""}`}
    data-changes={String(changes)}
    key={changes}
  >
    {children}
  </Layer>
)
