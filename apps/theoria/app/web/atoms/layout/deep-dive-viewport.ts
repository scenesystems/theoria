import { Atom } from "@effect-atom/atom"

import {
  clampedProjectedSurfaceCountForWorkspaceWidth,
  nextFocusedSurfaceAfterProjectedCountClamp
} from "./deep-dive-model.js"
import {
  deepDiveFocusedSurfaceAtom,
  deepDiveProjectedSurfaceCountAtom,
  deepDiveSurfaceOrderAtom
} from "./deep-dive-surface-projection.js"

export { deepDiveMaxProjectedSurfaceCountAtom, deepDiveWorkspaceWidthAtom } from "./deep-dive-viewport-state.js"

import { deepDiveWorkspaceWidthAtom } from "./deep-dive-viewport-state.js"

export const setDeepDiveWorkspaceWidthAtom = Atom.fnSync<number>()(
  (workspaceWidth, ctx) => {
    const nextWorkspaceWidth = Math.max(0, Math.round(workspaceWidth))
    const currentProjectedCount = ctx(deepDiveProjectedSurfaceCountAtom)
    const nextProjectedCount = clampedProjectedSurfaceCountForWorkspaceWidth({
      projectedCount: currentProjectedCount,
      workspaceWidthPx: nextWorkspaceWidth
    })

    ctx.set(deepDiveWorkspaceWidthAtom, nextWorkspaceWidth)

    if (nextProjectedCount === currentProjectedCount) {
      return
    }

    const nextOrder = ctx(deepDiveSurfaceOrderAtom)

    ctx.set(deepDiveProjectedSurfaceCountAtom, nextProjectedCount)
    ctx.set(
      deepDiveFocusedSurfaceAtom,
      nextFocusedSurfaceAfterProjectedCountClamp({
        currentFocusedSurface: ctx(deepDiveFocusedSurfaceAtom),
        nextOrder,
        nextProjectedCount
      })
    )
  }
)
