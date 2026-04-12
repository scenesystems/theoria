import { Atom } from "@effect-atom/atom"

import { deepDiveVisibleProjectedSurfaceCount } from "../../../contracts/presentation/deep-dive-projection-order.js"

import { deepDiveProjectedSurfaceCountAtom, deepDiveSurfaceOrderAtom } from "./deep-dive-projection-state.js"
import { deepDiveMaxProjectedSurfaceCountAtom } from "./deep-dive-viewport-state.js"

export const deepDiveVisibleProjectedSurfaceCountAtom = Atom.make((get) =>
  deepDiveVisibleProjectedSurfaceCount({
    maxProjectedCount: get(deepDiveMaxProjectedSurfaceCountAtom),
    projectedCount: get(deepDiveProjectedSurfaceCountAtom),
    surfaceCount: get(deepDiveSurfaceOrderAtom).length
  })
)
