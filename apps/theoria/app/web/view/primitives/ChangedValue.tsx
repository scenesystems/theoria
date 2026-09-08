import * as m from "motion/react-m"
import type { ReactNode } from "react"

import type { ToneClasses } from "./designSystem.js"
import { Layer } from "./Layout.js"
import { valueWashTransition } from "./motion.js"

/** The wash begins whole and settles to nothing. */
const washFrom = { opacity: 1 }
const washSettled = { opacity: 0 }

/**
 * Wraps a value that should be seen to change. `changes` counts how often the
 * value has changed since it first appeared; each increment remounts the
 * wrapper, which lights a wash in the tone behind the value and lets it settle
 * to nothing. Zero is the first appearance and gets no wash, so nothing lights
 * up on first paint.
 *
 * The wash is colour alone, so it plays under reduced motion too: a value that
 * changed is still seen to have changed, and nothing about it moves. It sits
 * behind the value in its own stacking context, four pixels past its box.
 */
export const ChangedValue = ({ changes, children, className, tone }: {
  readonly changes: number
  readonly children: ReactNode
  readonly className?: string
  readonly tone: ToneClasses
}) => (
  <Layer className={`relative isolate ${className ?? ""}`} data-changes={String(changes)} key={changes}>
    {changes > 0
      ? (
        <Layer
          aria-hidden
          className={`pointer-events-none absolute -inset-1 -z-10 rounded ${tone.wash}`}
          data-place-wash
          render={<m.span animate={washSettled} initial={washFrom} transition={valueWashTransition} />}
        />
      )
      : null}
    {children}
  </Layer>
)
