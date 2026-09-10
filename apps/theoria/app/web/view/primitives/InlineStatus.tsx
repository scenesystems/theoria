import type { HTMLAttributes } from "react"

import { classNames } from "./classNames.js"
import type { InlineStatusTone } from "./designSystem.js"
import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

/**
 * A status said in the line, not on a chip: a small dot in the tone, then the
 * words. It sits on whatever surface the text is on and adds no surface of
 * its own, so a row of statuses reads as one sentence with punctuation.
 *
 * @since 0.1.0
 */
export const InlineStatus = ({
  className = "",
  label,
  tone,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  readonly className?: string
  readonly label: string
  readonly tone: InlineStatusTone
}) => (
  <Layer
    {...rest}
    render={<span />}
    className={classNames("inline-flex min-w-0 items-center gap-1.5", className)}
  >
    <Layer aria-hidden render={<span />} className={`inline-flex size-1.5 shrink-0 rounded-full ${tone.dot}`} />
    <SemanticText as="span" className={tone.text} role="tab-label" text={label} variant="compact" />
  </Layer>
)
