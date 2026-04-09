import type { ReactNode } from "react"
import type { PaneScroll } from "../../../contracts/presentation/layout.js"

import { Pane } from "../containers/Pane.js"
import { SurfacePlaneFrame } from "../primitives/SurfacePlaneFrame.js"

export const projectionSurfacePaneClassName = "min-h-0 h-full flex-1 bg-stage-0"

export const ProjectionSurfaceFramePane = ({
  badge,
  children,
  hintText,
  scroll,
  summaryText,
  title
}: {
  readonly badge: ReactNode
  readonly children: ReactNode
  readonly hintText: string
  readonly scroll: PaneScroll
  readonly summaryText: string
  readonly title: string
}) => (
  <Pane className={projectionSurfacePaneClassName} scroll={scroll}>
    <SurfacePlaneFrame
      badge={badge}
      hintText={hintText}
      summaryText={summaryText}
      title={title}
      variant="expanded"
    >
      {children}
    </SurfacePlaneFrame>
  </Pane>
)
