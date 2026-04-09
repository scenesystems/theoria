import { Atom } from "@effect-atom/atom"

import { deepDiveProjectionLaneAtom, deepDiveProjectionLaneViewportChange } from "./deep-dive-projection-lane.js"
import { applyDeepDiveProjectionLaneWriteAtom } from "./deep-dive-projection-state.js"

import { deepDiveWorkspaceWidthAtom } from "./deep-dive-viewport-state.js"

export const setDeepDiveWorkspaceWidthAtom = Atom.fnSync<number>()(
  (workspaceWidth, ctx) => {
    const nextWorkspaceWidth = Math.max(0, Math.round(workspaceWidth))
    const projectionLane = ctx(deepDiveProjectionLaneAtom)
    const viewportChange = deepDiveProjectionLaneViewportChange({
      lane: projectionLane,
      workspaceWidthPx: nextWorkspaceWidth
    })

    ctx.set(deepDiveWorkspaceWidthAtom, nextWorkspaceWidth)

    if (
      viewportChange.projectedCount === projectionLane.projectedCount &&
      viewportChange.focusedSurface === projectionLane.focusedSurface
    ) {
      return
    }

    ctx.set(applyDeepDiveProjectionLaneWriteAtom, viewportChange)
  }
)
