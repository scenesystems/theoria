import { Atom } from "@effect-atom/atom"

import type { DeepDiveProjectionOrderState } from "../../../contracts/presentation/deep-dive-projection-order-state.js"
import { deepDiveProjectionOrderState } from "../../../contracts/presentation/deep-dive-projection-order.js"

import {
  deepDiveFocusedSurfaceAtom,
  deepDiveProjectedSurfaceCountAtom,
  deepDiveSurfaceOrderAtom
} from "./deep-dive-projection-state.js"
import { deepDiveMaxProjectedSurfaceCountAtom } from "./deep-dive-viewport-state.js"

export type {
  DeepDiveProjectionOrderState,
  DeepDiveProjectionSurfaceState
} from "../../../contracts/presentation/deep-dive-projection-order-state.js"

export {
  deepDiveProjectionDropIndex,
  deepDiveProjectionOrderHideSurfaceChange,
  deepDiveProjectionOrderProjectSurfaceChange,
  deepDiveProjectionOrderReorderSurfaceChange,
  deepDiveProjectionOrderViewportChange,
  deepDiveProjectionSurfaceCanHide,
  deepDiveProjectionSurfaceIsProjected
} from "../../../contracts/presentation/deep-dive-projection-order.js"

export const deepDiveProjectionOrderAtom = Atom.make((get): DeepDiveProjectionOrderState => {
  const focusedSurface = get(deepDiveFocusedSurfaceAtom)
  const maxProjectedCount = get(deepDiveMaxProjectedSurfaceCountAtom)
  const projectedCount = get(deepDiveProjectedSurfaceCountAtom)
  const surfaceOrder = get(deepDiveSurfaceOrderAtom)

  return deepDiveProjectionOrderState({
    focusedSurface,
    maxProjectedCount,
    projectedCount,
    surfaceOrder
  })
})
