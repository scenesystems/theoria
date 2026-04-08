import { Atom } from "@effect-atom/atom"

import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"
import { isProjectedSurface } from "./deep-dive-model.js"
import {
  deepDiveProjectedSurfaceCountAtom,
  deepDiveSurfaceOrderAtom,
  hideDeepDiveProjectedSurfaceAtom,
  projectDeepDiveSurfaceAtom,
  reorderDeepDiveProjectedSurfaceAtom
} from "./deep-dive-surface-projection.js"
import { deepDiveMaxProjectedSurfaceCountAtom } from "./deep-dive-viewport.js"

type DeepDiveDragPointer = {
  readonly x: number
  readonly y: number
}

type DeepDiveDragGhostTarget = {
  readonly width: number
  readonly x: number
  readonly y: number
}

export const deepDiveDraggedSurfaceAtom = Atom.make<DeepDiveProjectionPlane | null>(null).pipe(Atom.keepAlive)

export const deepDiveDragPointerAtom = Atom.make<DeepDiveDragPointer | null>(null).pipe(Atom.keepAlive)

export const deepDiveDragGhostTargetAtom = Atom.make<DeepDiveDragGhostTarget | null>(null).pipe(Atom.keepAlive)

export const deepDiveDragHoverLotIndexAtom = Atom.make<number | null>(null).pipe(Atom.keepAlive)

export const deepDiveDragHoverHideTargetAtom = Atom.make(false).pipe(Atom.keepAlive)

export const clearDeepDiveDraggedSurfaceAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveDraggedSurfaceAtom, null)
    ctx.set(deepDiveDragPointerAtom, null)
    ctx.set(deepDiveDragGhostTargetAtom, null)
    ctx.set(deepDiveDragHoverLotIndexAtom, null)
    ctx.set(deepDiveDragHoverHideTargetAtom, false)
  }
)

export const startDeepDiveSurfaceDragAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    ctx.set(deepDiveDraggedSurfaceAtom, surface)
    ctx.set(deepDiveDragHoverLotIndexAtom, null)
    ctx.set(deepDiveDragHoverHideTargetAtom, false)
  }
)

export const setDeepDiveDragHoverLotIndexAtom = Atom.fnSync<number | null>()(
  (index, ctx) => {
    ctx.set(deepDiveDragHoverLotIndexAtom, index)

    if (index !== null) {
      ctx.set(deepDiveDragHoverHideTargetAtom, false)
    }
  }
)

export const setDeepDiveDragPointerAtom = Atom.fnSync<DeepDiveDragPointer | null>()(
  (pointer, ctx) => {
    ctx.set(deepDiveDragPointerAtom, pointer)
  }
)

export const setDeepDiveDragGhostTargetAtom = Atom.fnSync<DeepDiveDragGhostTarget | null>()(
  (target, ctx) => {
    ctx.set(deepDiveDragGhostTargetAtom, target)
  }
)

export const setDeepDiveDragHoverHideTargetAtom = Atom.fnSync<boolean>()(
  (active, ctx) => {
    ctx.set(deepDiveDragHoverHideTargetAtom, active)

    if (active) {
      ctx.set(deepDiveDragHoverLotIndexAtom, null)
    }
  }
)

export const dropDeepDiveDraggedSurfaceAtom = Atom.fnSync<number>()(
  (index, ctx) => {
    const surface = ctx(deepDiveDraggedSurfaceAtom)

    if (surface === null) {
      return
    }

    const order = ctx(deepDiveSurfaceOrderAtom)
    const projectedCount = Math.min(
      ctx(deepDiveProjectedSurfaceCountAtom),
      ctx(deepDiveMaxProjectedSurfaceCountAtom)
    )

    if (isProjectedSurface({ order, projectedCount, surface })) {
      ctx.set(reorderDeepDiveProjectedSurfaceAtom, {
        index: Math.max(0, Math.min(projectedCount - 1, index)),
        surface
      })
    } else {
      ctx.set(projectDeepDiveSurfaceAtom, { index, surface })
    }

    ctx.set(clearDeepDiveDraggedSurfaceAtom, undefined)
  }
)

export const releaseDeepDiveDraggedSurfaceAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    if (ctx(deepDiveDragHoverHideTargetAtom)) {
      ctx.set(hideDeepDiveDraggedSurfaceAtom, undefined)
      return
    }

    const hoveredLotIndex = ctx(deepDiveDragHoverLotIndexAtom)

    if (hoveredLotIndex !== null) {
      ctx.set(dropDeepDiveDraggedSurfaceAtom, hoveredLotIndex)
      return
    }

    ctx.set(clearDeepDiveDraggedSurfaceAtom, undefined)
  }
)

export const hideDeepDiveDraggedSurfaceAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    const surface = ctx(deepDiveDraggedSurfaceAtom)
    const order = ctx(deepDiveSurfaceOrderAtom)
    const projectedCount = Math.min(
      ctx(deepDiveProjectedSurfaceCountAtom),
      ctx(deepDiveMaxProjectedSurfaceCountAtom)
    )

    if (surface === null || projectedCount <= 1 || !isProjectedSurface({ order, projectedCount, surface })) {
      return
    }

    ctx.set(hideDeepDiveProjectedSurfaceAtom, surface)
    ctx.set(clearDeepDiveDraggedSurfaceAtom, undefined)
  }
)

export const setDeepDiveDraggedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane | null>()(
  (surface, ctx) => {
    ctx.set(deepDiveDraggedSurfaceAtom, surface)
  }
)
