import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

/**
 * Compact status pill — centered text inside a rounded capsule.
 *
 * Always centers its label vertically and horizontally. Accepts `className`
 * for background/text/border theming via design tokens.
 *
 * @since 0.1.0
 */
export const StatusPill = ({
  className,
  label
}: {
  readonly className: string
  readonly label: string
}) => (
  <Layer
    as="span"
    className={`inline-flex shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 leading-none ${className}`}
  >
    <SemanticText as="span" role="tab-label" text={label} variant="compact" />
  </Layer>
)
