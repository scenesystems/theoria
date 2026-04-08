import type { SurfaceVariant } from "../../../contracts/presentation/program.js"

import type { Badge } from "./designSystem.js"
import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

export const ProjectionOrdinal = ({
  badge,
  label,
  variant
}: {
  readonly badge: Badge
  readonly label: string
  readonly variant: SurfaceVariant
}) => (
  <Layer
    as="span"
    className={`inline-flex shrink-0 items-center gap-2 rounded-[0.95rem] border px-2.5 py-1 shadow-chip transition-colors duration-150 ${badge.shell}`}
  >
    <Layer as="span" aria-hidden className={`h-4 w-0.5 shrink-0 rounded-full ${badge.dot}`} />
    <SemanticText
      as="span"
      className={`${badge.label ?? "text-ink-700"} uppercase tracking-[0.18em]`}
      role="code-meta"
      text={label}
      variant={variant}
    />
  </Layer>
)
