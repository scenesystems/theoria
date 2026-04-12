import { Atom } from "@effect-atom/atom"

import { deepDiveProjectionOrderAtom, deepDiveProjectionOrderViewportChange } from "./deep-dive-projection-order.js"
import { applyDeepDiveProjectionOrderWriteAtom } from "./deep-dive-projection-state.js"

import { deepDiveWorkspaceWidthAtom } from "./deep-dive-viewport-state.js"

export const setDeepDiveWorkspaceWidthAtom = Atom.fnSync<number>()(
  (workspaceWidth, ctx) => {
    const nextWorkspaceWidth = Math.max(0, Math.round(workspaceWidth))
    const projectionOrder = ctx(deepDiveProjectionOrderAtom)
    const viewportChange = deepDiveProjectionOrderViewportChange({
      order: projectionOrder,
      workspaceWidthPx: nextWorkspaceWidth
    })

    ctx.set(deepDiveWorkspaceWidthAtom, nextWorkspaceWidth)

    if (
      viewportChange.projectedCount === projectionOrder.projectedCount &&
      viewportChange.focusedSurface === projectionOrder.focusedSurface
    ) {
      return
    }

    ctx.set(applyDeepDiveProjectionOrderWriteAtom, viewportChange)
  }
)
