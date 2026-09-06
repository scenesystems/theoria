import type { CSSProperties, ReactNode, RefCallback } from "react"

import { classNames } from "./classNames.js"
import { Layer } from "./Layout.js"

/**
 * The frame's border on each side. The frame is drawn with this value, and
 * anything that budgets a column for the frame (the stage atoms) subtracts it,
 * so the two can never disagree.
 */
export const artifactStageBorderPx = 1

const viewportClassName = "flex h-full min-h-0 w-full overflow-x-auto"
const frameClassName =
  "relative flex min-h-full flex-col overflow-hidden rounded-lg border-solid border-stage-200/80 bg-stage-0"
const bodyClassName = "relative box-border min-h-0 w-full flex-1 overflow-hidden"

export const ArtifactStage = ({
  bodyStyle,
  children,
  className = "",
  frameStyle,
  viewportClassName: extraViewportClassName = "",
  viewportRef
}: {
  readonly bodyStyle?: CSSProperties
  readonly children: ReactNode
  readonly className?: string
  readonly frameStyle?: CSSProperties
  readonly viewportClassName?: string
  readonly viewportRef: RefCallback<HTMLElement>
}) => (
  <Layer
    className={classNames(viewportClassName, extraViewportClassName)}
    data-artifact-stage="viewport"
    ref={viewportRef}
  >
    <Layer
      className={classNames(frameClassName, className)}
      data-artifact-stage="frame"
      style={{ borderWidth: artifactStageBorderPx, ...frameStyle }}
    >
      <Layer className={bodyClassName} data-artifact-stage="body" style={bodyStyle}>
        {children}
      </Layer>
    </Layer>
  </Layer>
)
