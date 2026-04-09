import { Atom } from "@effect-atom/atom"

import { DeepDiveSurfacePlaneValue } from "../../../contracts/presentation/layout.js"
import type { DeepDiveProjectionLaneChange } from "../../state/surface/deep-dive-projection-lane.js"
import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"

import {
  deepDiveProjectedSurfaceCountDefault,
  deepDiveSurfaceOrderDefault
} from "../../state/surface/deep-dive-lane-model.js"

export type DeepDiveProjectionLaneWrite = DeepDiveProjectionLaneChange

export const deepDiveSurfaceOrderAtom = Atom.make<ReadonlyArray<DeepDiveProjectionPlane>>(deepDiveSurfaceOrderDefault)
  .pipe(Atom.keepAlive)

export const deepDiveProjectedSurfaceCountAtom = Atom.make<number>(deepDiveProjectedSurfaceCountDefault).pipe(
  Atom.keepAlive
)

export const deepDiveFocusedSurfaceAtom = Atom.make<DeepDiveProjectionPlane>(DeepDiveSurfacePlaneValue.Stage).pipe(
  Atom.keepAlive
)

export const applyDeepDiveProjectionLaneWriteAtom = Atom.fnSync<DeepDiveProjectionLaneWrite>()(
  ({ focusedSurface, projectedCount, surfaceOrder }, ctx) => {
    ctx.set(deepDiveSurfaceOrderAtom, surfaceOrder)
    ctx.set(deepDiveProjectedSurfaceCountAtom, projectedCount)
    ctx.set(deepDiveFocusedSurfaceAtom, focusedSurface)
  }
)
