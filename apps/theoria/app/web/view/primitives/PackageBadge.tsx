import type { SurfaceVariant } from "../../../contracts/presentation.js"

import type { BadgeTheme } from "./designSystem.js"
import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

export const PackageBadge = ({
  badge,
  label,
  variant
}: {
  readonly badge: BadgeTheme
  readonly label: string
  readonly variant: SurfaceVariant
}) => (
  <Layer
    as="span"
    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 shadow-chip transition-colors duration-150 ${badge.shell}`}
  >
    <Layer as="span" aria-hidden className={`mr-2 inline-flex h-1.5 w-1.5 rounded-full ${badge.dot}`} />
    <SemanticText
      as="span"
      className={badge.label ?? ""}
      role="tab-label"
      text={label}
      variant={variant}
    />
  </Layer>
)
