import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match } from "effect"

import {
  type ProjectionDockDragTarget,
  projectionDockDropTargetAt,
  type ProjectionDockGhostTarget
} from "../../runtime/kernel/projection-dock-target.js"
import {
  clearDeepDiveDragState,
  type DeepDiveDragGhostTarget,
  type DeepDiveDragPointer,
  deepDiveDragReleaseAction,
  type DeepDiveDragState,
  deepDiveDragStateWithDraggedSurface,
  deepDiveDragStateWithGhostTarget,
  deepDiveDragStateWithHoveredHideTarget,
  deepDiveDragStateWithHoveredLotIndex,
  deepDiveDragStateWithPointer,
  deepDiveProjectionLaneDropSurfaceChange,
  deepDiveProjectionLaneHideDraggedSurfaceChange,
  emptyDeepDiveDragState,
  startDeepDiveDragState
} from "../../state/surface/deep-dive-drag.js"
import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"

import { deepDiveProjectionLaneAtom } from "./deep-dive-projection-lane.js"
import { applyDeepDiveProjectionLaneWriteAtom } from "./deep-dive-projection-state.js"

const deepDiveDragStateStoreAtom = Atom.make<DeepDiveDragState>(emptyDeepDiveDragState).pipe(Atom.keepAlive)

export const deepDiveDragStateAtom = Atom.make((get): DeepDiveDragState => get(deepDiveDragStateStoreAtom))

export const clearDeepDiveDraggedSurfaceAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveDragStateStoreAtom, clearDeepDiveDragState())
  }
)

export const startDeepDiveSurfaceDragAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    ctx.set(deepDiveDragStateStoreAtom, startDeepDiveDragState(surface))
  }
)

export const setDeepDiveDragHoverLotIndexAtom = Atom.fnSync<number | null>()(
  (index, ctx) => {
    ctx.set(
      deepDiveDragStateStoreAtom,
      deepDiveDragStateWithHoveredLotIndex({ index, state: ctx(deepDiveDragStateStoreAtom) })
    )
  }
)

export const setDeepDiveDragPointerAtom = Atom.fnSync<DeepDiveDragPointer | null>()(
  (pointer, ctx) => {
    ctx.set(
      deepDiveDragStateStoreAtom,
      deepDiveDragStateWithPointer({ pointer, state: ctx(deepDiveDragStateStoreAtom) })
    )
  }
)

export const setDeepDiveDragGhostTargetAtom = Atom.fnSync<DeepDiveDragGhostTarget | null>()(
  (target, ctx) => {
    ctx.set(
      deepDiveDragStateStoreAtom,
      deepDiveDragStateWithGhostTarget({ state: ctx(deepDiveDragStateStoreAtom), target })
    )
  }
)

export const setDeepDiveDragHoverHideTargetAtom = Atom.fnSync<boolean>()(
  (active, ctx) => {
    ctx.set(
      deepDiveDragStateStoreAtom,
      deepDiveDragStateWithHoveredHideTarget({ active, state: ctx(deepDiveDragStateStoreAtom) })
    )
  }
)

const syncDeepDiveDragTarget = (
  ctx: AtomType.FnContext,
  target: ProjectionDockDragTarget
): void => {
  const ghostTarget = (value: ProjectionDockGhostTarget | null): DeepDiveDragGhostTarget | null => value

  Match.value(target).pipe(
    Match.tag("EmptyProjectionDockDragTarget", ({ ghostTarget: nextGhostTarget }) => {
      ctx.set(setDeepDiveDragGhostTargetAtom, ghostTarget(nextGhostTarget))
      ctx.set(setDeepDiveDragHoverLotIndexAtom, null)
      ctx.set(setDeepDiveDragHoverHideTargetAtom, false)
    }),
    Match.tag("HideProjectionDockDragTarget", ({ ghostTarget: nextGhostTarget }) => {
      ctx.set(setDeepDiveDragGhostTargetAtom, ghostTarget(nextGhostTarget))
      ctx.set(setDeepDiveDragHoverLotIndexAtom, null)
      ctx.set(setDeepDiveDragHoverHideTargetAtom, true)
    }),
    Match.tag("SlotProjectionDockDragTarget", ({ ghostTarget: nextGhostTarget, lotIndex }) => {
      ctx.set(setDeepDiveDragGhostTargetAtom, ghostTarget(nextGhostTarget))
      ctx.set(setDeepDiveDragHoverLotIndexAtom, lotIndex)
      ctx.set(setDeepDiveDragHoverHideTargetAtom, false)
    }),
    Match.exhaustive
  )
}

export const moveDeepDiveDraggedSurfaceAtom = Atom.fnSync<DeepDiveDragPointer>()(
  (pointer, ctx) => {
    ctx.set(setDeepDiveDragPointerAtom, pointer)
    syncDeepDiveDragTarget(ctx, projectionDockDropTargetAt({ clientX: pointer.x, clientY: pointer.y }))
  }
)

export const completeDeepDiveDraggedSurfaceAtom = Atom.fnSync<DeepDiveDragPointer>()(
  (pointer, ctx) => {
    Match.value(projectionDockDropTargetAt({ clientX: pointer.x, clientY: pointer.y })).pipe(
      Match.tag("HideProjectionDockDragTarget", () => {
        ctx.set(hideDeepDiveDraggedSurfaceAtom, undefined)
      }),
      Match.tag("SlotProjectionDockDragTarget", ({ lotIndex }) => {
        ctx.set(dropDeepDiveDraggedSurfaceAtom, lotIndex)
      }),
      Match.tag("EmptyProjectionDockDragTarget", () => {
        ctx.set(clearDeepDiveDraggedSurfaceAtom, undefined)
      }),
      Match.exhaustive
    )
  }
)

export const dropDeepDiveDraggedSurfaceAtom = Atom.fnSync<number>()(
  (index, ctx) => {
    const change = deepDiveProjectionLaneDropSurfaceChange({
      index,
      lane: ctx(deepDiveProjectionLaneAtom),
      state: ctx(deepDiveDragStateStoreAtom)
    })

    if (change !== null) {
      ctx.set(applyDeepDiveProjectionLaneWriteAtom, change)
    }

    ctx.set(clearDeepDiveDraggedSurfaceAtom, undefined)
  }
)

export const releaseDeepDiveDraggedSurfaceAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    Match.value(deepDiveDragReleaseAction(ctx(deepDiveDragStateStoreAtom))).pipe(
      Match.tag("HideDeepDiveDragSurface", () => {
        ctx.set(hideDeepDiveDraggedSurfaceAtom, undefined)
      }),
      Match.tag("DropDeepDiveDragSurface", ({ index }) => {
        ctx.set(dropDeepDiveDraggedSurfaceAtom, index)
      }),
      Match.tag("ClearDeepDiveDrag", () => {
        ctx.set(clearDeepDiveDraggedSurfaceAtom, undefined)
      }),
      Match.exhaustive
    )
  }
)

export const hideDeepDiveDraggedSurfaceAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    const change = deepDiveProjectionLaneHideDraggedSurfaceChange({
      lane: ctx(deepDiveProjectionLaneAtom),
      state: ctx(deepDiveDragStateStoreAtom)
    })

    if (change === null) {
      return
    }

    ctx.set(applyDeepDiveProjectionLaneWriteAtom, change)
    ctx.set(clearDeepDiveDraggedSurfaceAtom, undefined)
  }
)

export const setDeepDiveDraggedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane | null>()(
  (surface, ctx) => {
    ctx.set(
      deepDiveDragStateStoreAtom,
      deepDiveDragStateWithDraggedSurface({ state: ctx(deepDiveDragStateStoreAtom), surface })
    )
  }
)
