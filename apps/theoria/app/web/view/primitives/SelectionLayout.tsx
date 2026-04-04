import type { ReactNode } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import type { TextRole } from "../../../contracts/text.js"

import { Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const classes = (...entries: ReadonlyArray<string | undefined>): string =>
  entries.filter((entry) => entry !== undefined && entry.length > 0).join(" ")

type ActionBreakpoint = "always" | "md" | "lg"

const selectionRailColumns = ({
  action,
  accent,
  actionBreakpoint
}: {
  readonly action: ReactNode | undefined
  readonly accent: ReactNode | undefined
  readonly actionBreakpoint: ActionBreakpoint
}): string => {
  if (actionBreakpoint === "md") {
    if (accent !== undefined && action !== undefined) {
      return "grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_auto]"
    }

    if (action !== undefined) {
      return "grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_auto]"
    }
  }

  if (actionBreakpoint === "lg") {
    if (accent !== undefined && action !== undefined) {
      return "grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_auto]"
    }

    if (action !== undefined) {
      return "grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto]"
    }
  }

  if (accent !== undefined && action !== undefined) {
    return "grid-cols-[auto_minmax(0,1fr)_auto]"
  }

  if (accent !== undefined) {
    return "grid-cols-[auto_minmax(0,1fr)]"
  }

  if (action !== undefined) {
    return "grid-cols-[minmax(0,1fr)_auto]"
  }

  return "grid-cols-[minmax(0,1fr)]"
}

export const SelectionRail = ({
  action,
  actionClassName,
  actionBreakpoint = "always",
  accent,
  children,
  className
}: {
  readonly action?: ReactNode
  readonly actionClassName?: string
  readonly actionBreakpoint?: ActionBreakpoint
  readonly accent?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}) => (
  <Layer
    className={classes(
      "grid w-full min-w-0 items-start gap-x-3",
      selectionRailColumns({ action, accent, actionBreakpoint }),
      className
    )}
  >
    {accent === undefined ? null : accent}
    <Layer className="min-w-0 w-full">{children}</Layer>
    {action === undefined
      ? null
      : <Layer className={classes("min-w-0 justify-self-end", actionClassName)}>{action}</Layer>}
  </Layer>
)

export const SelectionCopy = ({
  detail,
  detailClassName = "max-w-none text-ink-500",
  detailRole = "code-meta",
  detailVariant = "compact",
  title,
  titleClassName = "text-ink-900",
  titleRole,
  titleVariant = "expanded"
}: {
  readonly detail?: string | null
  readonly detailClassName?: string
  readonly detailRole?: TextRole
  readonly detailVariant?: SurfaceVariant
  readonly title: string
  readonly titleClassName?: string
  readonly titleRole: TextRole
  readonly titleVariant?: SurfaceVariant
}) => (
  <Stack className="min-w-0 gap-0.5">
    <SemanticText
      as="p"
      className={titleClassName}
      role={titleRole}
      text={title}
      variant={titleVariant}
    />
    {detail === undefined || detail === null
      ? null
      : (
        <SemanticText
          as="p"
          className={detailClassName}
          role={detailRole}
          text={detail}
          variant={detailVariant}
        />
      )}
  </Stack>
)
