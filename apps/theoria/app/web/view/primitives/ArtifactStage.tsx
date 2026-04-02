import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react"

import { Layer } from "./Layout.js"

const viewportClassName = "flex h-full min-h-0 w-full overflow-x-auto"
const frameClassName =
  "relative flex min-h-full flex-col overflow-hidden rounded-lg border border-stage-200/80 bg-stage-0"
const bodyClassName = "relative box-border min-h-0 w-full flex-1 overflow-hidden"

const withClassName = (base: string, extra: string | undefined): string =>
  extra === undefined ? base : `${base} ${extra}`

export const ArtifactStage = ({
  bodyStyle,
  children,
  className,
  frameStyle,
  viewportClassName: extraViewportClassName,
  viewportRef
}: {
  readonly bodyStyle?: CSSProperties
  readonly children: ReactNode
  readonly className?: string
  readonly frameStyle?: CSSProperties
  readonly viewportClassName?: string
  readonly viewportRef?: ComponentPropsWithRef<"div">["ref"]
}) => (
  <Layer className={withClassName(viewportClassName, extraViewportClassName)} ref={viewportRef}>
    <Layer className={withClassName(frameClassName, className)} style={frameStyle}>
      <Layer className={bodyClassName} style={bodyStyle}>
        {children}
      </Layer>
    </Layer>
  </Layer>
)
