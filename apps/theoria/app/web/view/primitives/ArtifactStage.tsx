import type { CSSProperties, ReactNode, RefCallback } from "react"

import { classNames } from "./classNames.js"
import { Layer } from "./Layout.js"

const viewportClassName = "flex h-full min-h-0 w-full overflow-x-auto"
const frameClassName =
  "relative flex min-h-full flex-col overflow-hidden rounded-lg border border-stage-200/80 bg-stage-0"
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
  <Layer className={classNames(viewportClassName, extraViewportClassName)} ref={viewportRef}>
    <Layer className={classNames(frameClassName, className)} style={frameStyle}>
      <Layer className={bodyClassName} style={bodyStyle}>
        {children}
      </Layer>
    </Layer>
  </Layer>
)
