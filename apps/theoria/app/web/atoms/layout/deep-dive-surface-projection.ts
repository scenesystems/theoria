import { Atom } from "@effect-atom/atom"

import type { DeepDiveProjectionPlane } from "../../../contracts/presentation/deep-dive-projection.js"
import {
  deepDiveProjectionOrderAtom,
  deepDiveProjectionOrderHideSurfaceChange,
  deepDiveProjectionOrderProjectSurfaceChange,
  deepDiveProjectionOrderReorderSurfaceChange,
  deepDiveProjectionSurfaceIsProjected
} from "./deep-dive-projection-order.js"
import { applyDeepDiveProjectionOrderWriteAtom, deepDiveFocusedSurfaceAtom } from "./deep-dive-projection-state.js"

type ProjectDeepDiveSurfaceInput = {
  readonly index?: number
  readonly surface: DeepDiveProjectionPlane
}

type ReorderDeepDiveProjectedSurfaceInput = {
  readonly index: number
  readonly surface: DeepDiveProjectionPlane
}

export const focusDeepDiveSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const projectionOrder = ctx(deepDiveProjectionOrderAtom)

    if (deepDiveProjectionSurfaceIsProjected({ order: projectionOrder, surface })) {
      ctx.set(deepDiveFocusedSurfaceAtom, surface)
    }
  }
)

export const projectDeepDiveSurfaceAtom = Atom.fnSync<ProjectDeepDiveSurfaceInput>()(
  ({ index, surface }, ctx) => {
    const change = deepDiveProjectionOrderProjectSurfaceChange({
      order: ctx(deepDiveProjectionOrderAtom),
      surface,
      ...(typeof index === "number" ? { index } : {})
    })

    if (change === null) {
      return
    }

    ctx.set(applyDeepDiveProjectionOrderWriteAtom, change)
  }
)

export const reorderDeepDiveProjectedSurfaceAtom = Atom.fnSync<ReorderDeepDiveProjectedSurfaceInput>()(
  ({ index, surface }, ctx) => {
    const change = deepDiveProjectionOrderReorderSurfaceChange({
      index,
      order: ctx(deepDiveProjectionOrderAtom),
      surface
    })

    if (change === null) {
      return
    }

    ctx.set(applyDeepDiveProjectionOrderWriteAtom, change)
  }
)

export const hideDeepDiveProjectedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const change = deepDiveProjectionOrderHideSurfaceChange({
      order: ctx(deepDiveProjectionOrderAtom),
      surface
    })

    if (change === null) {
      return
    }

    ctx.set(applyDeepDiveProjectionOrderWriteAtom, change)
  }
)

export const toggleDeepDiveProjectedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const projectionOrder = ctx(deepDiveProjectionOrderAtom)

    if (deepDiveProjectionSurfaceIsProjected({ order: projectionOrder, surface })) {
      ctx.set(hideDeepDiveProjectedSurfaceAtom, surface)
      return
    }

    ctx.set(projectDeepDiveSurfaceAtom, { surface })
  }
)
