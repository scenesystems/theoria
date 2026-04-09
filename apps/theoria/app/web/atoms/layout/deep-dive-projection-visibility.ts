import { Atom } from "@effect-atom/atom"

import { deepDiveVisibleProjectedSurfaceCount } from "../../state/surface/deep-dive-projection-lane.js"

import { deepDiveProjectedSurfaceCountAtom } from "./deep-dive-projection-state.js"
import { deepDiveMaxProjectedSurfaceCountAtom } from "./deep-dive-viewport-state.js"

export const deepDiveVisibleProjectedSurfaceCountAtom = Atom.make((get) =>
  deepDiveVisibleProjectedSurfaceCount({
    maxProjectedCount: get(deepDiveMaxProjectedSurfaceCountAtom),
    projectedCount: get(deepDiveProjectedSurfaceCountAtom)
  })
)
