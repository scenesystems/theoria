import type { ReactNode } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation.js"

import { HintTooltip } from "./HintTooltip.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const planeShellClassName = "min-h-0 h-full flex-1 bg-stage-0"

const planeHeaderClassName = "shrink-0 border-b border-stage-200/80 bg-stage-0 px-4 py-4 sm:px-5"

const planeContentClassName = (contentClassName: string | undefined): string =>
  `flex min-h-0 flex-1 flex-col ${contentClassName ?? "px-4 py-4 sm:px-5 sm:py-5"}`

export const SurfacePlaneFrame = ({
  actions,
  badge,
  children,
  className,
  contentClassName,
  headerClassName,
  hintText,
  meta,
  summaryText,
  title,
  variant
}: {
  readonly actions?: ReactNode
  readonly badge?: ReactNode
  readonly children: ReactNode
  readonly className?: string
  readonly contentClassName?: string
  readonly headerClassName?: string
  readonly hintText?: string
  readonly meta?: ReactNode
  readonly summaryText?: string
  readonly title: string
  readonly variant: SurfaceVariant
}) => (
  <Stack className={`${planeShellClassName}${className !== undefined ? ` ${className}` : ""}`}>
    <Layer
      className={`${planeHeaderClassName}${headerClassName !== undefined ? ` ${headerClassName}` : ""}`}
    >
      <Stack className="gap-3.5">
        <Cluster className="items-start justify-between gap-3">
          <Stack className="min-w-0 flex-1 gap-2.5">
            <Cluster className="items-center gap-2">
              {badge ?? null}
              <SemanticText as="h3" className="text-ink-900" role="section-title" text={title} variant={variant} />
              {hintText === undefined ? null : <HintTooltip text={hintText} />}
            </Cluster>
            {summaryText === undefined
              ? null
              : (
                <SemanticText
                  as="p"
                  className="max-w-3xl text-ink-700"
                  role="status"
                  text={summaryText}
                  variant={variant}
                />
              )}
          </Stack>
          {actions === undefined
            ? null
            : <Cluster className="items-center justify-end gap-2">{actions}</Cluster>}
        </Cluster>
        {meta === undefined ? null : <Layer>{meta}</Layer>}
      </Stack>
    </Layer>
    <Layer className={planeContentClassName(contentClassName)}>{children}</Layer>
  </Stack>
)
