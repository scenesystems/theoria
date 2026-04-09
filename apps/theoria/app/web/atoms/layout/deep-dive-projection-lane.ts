import { Atom } from "@effect-atom/atom"

import {
  type DeepDiveProjectionLaneState,
  deepDiveProjectionLaneState
} from "../../state/surface/deep-dive-projection-lane.js"

import {
  deepDiveFocusedSurfaceAtom,
  deepDiveProjectedSurfaceCountAtom,
  deepDiveSurfaceOrderAtom
} from "./deep-dive-projection-state.js"
import { deepDiveMaxProjectedSurfaceCountAtom } from "./deep-dive-viewport-state.js"

export type {
  DeepDiveProjectionLaneState,
  DeepDiveProjectionSurfaceState
} from "../../state/surface/deep-dive-projection-lane.js"

export {
  deepDiveProjectionDropIndex,
  deepDiveProjectionLaneHideSurfaceChange,
  deepDiveProjectionLaneProjectSurfaceChange,
  deepDiveProjectionLaneReorderSurfaceChange,
  deepDiveProjectionLaneViewportChange,
  deepDiveProjectionSurfaceCanHide,
  deepDiveProjectionSurfaceIsProjected
} from "../../state/surface/deep-dive-projection-lane.js"

export const deepDiveProjectionLaneAtom = Atom.make((get): DeepDiveProjectionLaneState => {
  const focusedSurface = get(deepDiveFocusedSurfaceAtom)
  const maxProjectedCount = get(deepDiveMaxProjectedSurfaceCountAtom)
  const projectedCount = get(deepDiveProjectedSurfaceCountAtom)
  const surfaceOrder = get(deepDiveSurfaceOrderAtom)

  return deepDiveProjectionLaneState({
    focusedSurface,
    maxProjectedCount,
    projectedCount,
    surfaceOrder
  })
})
