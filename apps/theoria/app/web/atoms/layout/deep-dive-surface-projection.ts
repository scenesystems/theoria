import { Atom } from "@effect-atom/atom"

import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"
import {
  deepDiveProjectionLaneAtom,
  deepDiveProjectionLaneHideSurfaceChange,
  deepDiveProjectionLaneProjectSurfaceChange,
  deepDiveProjectionLaneReorderSurfaceChange,
  deepDiveProjectionSurfaceIsProjected
} from "./deep-dive-projection-lane.js"
import { applyDeepDiveProjectionLaneWriteAtom, deepDiveFocusedSurfaceAtom } from "./deep-dive-projection-state.js"

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
    const projectionLane = ctx(deepDiveProjectionLaneAtom)

    if (deepDiveProjectionSurfaceIsProjected({ lane: projectionLane, surface })) {
      ctx.set(deepDiveFocusedSurfaceAtom, surface)
    }
  }
)

export const projectDeepDiveSurfaceAtom = Atom.fnSync<ProjectDeepDiveSurfaceInput>()(
  ({ index, surface }, ctx) => {
    const change = deepDiveProjectionLaneProjectSurfaceChange({
      lane: ctx(deepDiveProjectionLaneAtom),
      surface,
      ...(typeof index === "number" ? { index } : {})
    })

    if (change === null) {
      return
    }

    ctx.set(applyDeepDiveProjectionLaneWriteAtom, change)
  }
)

export const reorderDeepDiveProjectedSurfaceAtom = Atom.fnSync<ReorderDeepDiveProjectedSurfaceInput>()(
  ({ index, surface }, ctx) => {
    const change = deepDiveProjectionLaneReorderSurfaceChange({
      index,
      lane: ctx(deepDiveProjectionLaneAtom),
      surface
    })

    if (change === null) {
      return
    }

    ctx.set(applyDeepDiveProjectionLaneWriteAtom, change)
  }
)

export const hideDeepDiveProjectedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const change = deepDiveProjectionLaneHideSurfaceChange({
      lane: ctx(deepDiveProjectionLaneAtom),
      surface
    })

    if (change === null) {
      return
    }

    ctx.set(applyDeepDiveProjectionLaneWriteAtom, change)
  }
)

export const toggleDeepDiveProjectedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const projectionLane = ctx(deepDiveProjectionLaneAtom)

    if (deepDiveProjectionSurfaceIsProjected({ lane: projectionLane, surface })) {
      ctx.set(hideDeepDiveProjectedSurfaceAtom, surface)
      return
    }

    ctx.set(projectDeepDiveSurfaceAtom, { surface })
  }
)
