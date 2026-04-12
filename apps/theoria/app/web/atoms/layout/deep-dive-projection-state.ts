import { Atom } from "@effect-atom/atom"

import {
  deepDiveFocusedSurfaceDefault,
  deepDiveProjectedSurfaceCountDefault,
  type DeepDiveProjectionOrderChange,
  deepDiveProjectionSurfaceOrder
} from "../../../contracts/presentation/deep-dive-projection-order-state.js"
import type { DeepDiveProjectionPlane } from "../../../contracts/presentation/deep-dive-projection.js"
import { diagnosticsProjectionEnabled } from "../../state/surface/deep-dive.js"

export type DeepDiveProjectionOrderWrite = DeepDiveProjectionOrderChange

export const deepDiveSurfaceOrderAtom = Atom.make<ReadonlyArray<DeepDiveProjectionPlane>>(
  deepDiveProjectionSurfaceOrder({ diagnosticsEnabled: diagnosticsProjectionEnabled })
).pipe(Atom.keepAlive)

export const deepDiveProjectedSurfaceCountAtom = Atom.make<number>(deepDiveProjectedSurfaceCountDefault).pipe(
  Atom.keepAlive
)

export const deepDiveFocusedSurfaceAtom = Atom.make<DeepDiveProjectionPlane>(deepDiveFocusedSurfaceDefault).pipe(
  Atom.keepAlive
)

export const applyDeepDiveProjectionOrderWriteAtom = Atom.fnSync<DeepDiveProjectionOrderWrite>()(
  ({ focusedSurface, projectedCount, surfaceOrder }, ctx) => {
    ctx.set(deepDiveSurfaceOrderAtom, surfaceOrder)
    ctx.set(deepDiveProjectedSurfaceCountAtom, projectedCount)
    ctx.set(deepDiveFocusedSurfaceAtom, focusedSurface)
  }
)
