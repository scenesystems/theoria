import { Match } from "effect"
import type { CSSProperties, ReactNode, RefCallback } from "react"

import type { ArtifactStageFrame } from "../../../contracts/layout.js"

import { classNames } from "./classNames.js"
import { Layer } from "./Layout.js"

/**
 * The frame's border on each side. The frame is drawn with this value, and
 * anything that budgets a column for the frame (the stage atoms) subtracts it,
 * so the two can never disagree. On the canvas there is no frame at all.
 */
export const artifactStageBorderPx = (frame: ArtifactStageFrame): number =>
  Match.value(frame).pipe(
    Match.when("none", () => 0),
    Match.when("instrument", () => 1),
    Match.exhaustive
  )

const frameSurfaceClassName = (frame: ArtifactStageFrame): string =>
  Match.value(frame).pipe(
    Match.when("none", () => ""),
    Match.when("instrument", () => "rounded-instrument border-solid border-rule bg-stage-0"),
    Match.exhaustive
  )

const viewportClassName = "flex h-full min-h-0 w-full overflow-x-auto"
const frameClassName = "relative flex min-h-full flex-col overflow-hidden"
const bodyClassName = "relative box-border min-h-0 w-full flex-1 overflow-hidden"

export const ArtifactStage = ({
  bodyStyle,
  children,
  className = "",
  frame,
  frameStyle,
  viewportClassName: extraViewportClassName = "",
  viewportRef
}: {
  readonly bodyStyle?: CSSProperties
  readonly children: ReactNode
  readonly className?: string
  readonly frame: ArtifactStageFrame
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
      className={classNames(frameClassName, frameSurfaceClassName(frame), className)}
      data-artifact-stage="frame"
      style={{ borderWidth: artifactStageBorderPx(frame), ...frameStyle }}
    >
      <Layer className={bodyClassName} data-artifact-stage="body" style={bodyStyle}>
        {children}
      </Layer>
    </Layer>
  </Layer>
)
