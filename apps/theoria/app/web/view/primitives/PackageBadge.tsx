import { Match } from "effect"

import type { SurfaceVariant } from "../../../contracts/presentation/program.js"

import { headerChromeButtonClassName } from "./HeaderChrome.js"
import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import type { Badge } from "./theme/badge.js"

const badgeShellClassName = ({
  badge,
  variant
}: {
  readonly badge: Badge
  readonly variant: SurfaceVariant
}): string =>
  Match.value(variant).pipe(
    Match.when(
      "compact",
      () => headerChromeButtonClassName({ active: false, className: `w-auto justify-start px-4 ${badge.shell}` })
    ),
    Match.orElse(
      () =>
        `inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 shadow-chip transition-colors duration-150 ${badge.shell}`
    )
  )

export const PackageBadge = ({
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
    className={badgeShellClassName({ badge, variant })}
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
