import { Atom } from "@effect-atom/atom"

import {
  type DeepDivePanePercent,
  DeepDivePanePercentDefault,
  DeepDivePanePercentMax,
  DeepDivePanePercentMin,
  DeepDiveSurfacePlaneValue
} from "../../contracts/layout.js"
import type { DeepDiveProjectionPlane } from "../state/deep-dive-surface.js"
import {
  clampedProjectedSurfaceCount,
  clampedProjectedSurfaceCountForWorkspaceWidth,
  deepDiveProjectedSurfaceCountDefault,
  deepDiveSurfaceOrderDefault,
  deepDiveWorkspaceWidthDefaultPx,
  insertSurfaceAt,
  isProjectedSurface,
  maxProjectedSurfaceCountForWorkspaceWidth,
  nextFocusedSurfaceAfterHide,
  nextFocusedSurfaceAfterProjectedCountClamp,
  projectedSurfaces,
  removeSurface
} from "./deep-dive-layout-model.js"

type ProjectDeepDiveSurfaceInput = {
  readonly index?: number
  readonly surface: DeepDiveProjectionPlane
}

type ReorderDeepDiveProjectedSurfaceInput = {
  readonly index: number
  readonly surface: DeepDiveProjectionPlane
}

type DeepDiveDragPointer = {
  readonly x: number
  readonly y: number
}

type DeepDiveDragGhostTarget = {
  readonly width: number
  readonly x: number
  readonly y: number
}

const clampedPanePercent = (value: number): DeepDivePanePercent =>
  Math.max(DeepDivePanePercentMin, Math.min(DeepDivePanePercentMax, Math.round(value)))

const projectedInsertionIndex = ({
  currentIndex,
  index,
  maxProjectedCount,
  projectedCount
}: {
  readonly currentIndex: number
  readonly index?: number
  readonly maxProjectedCount: number
  readonly projectedCount: number
}): number => {
  const alreadyProjected = currentIndex < projectedCount
  const defaultIndex = alreadyProjected
    ? currentIndex
    : projectedCount >= maxProjectedCount
    ? Math.max(0, maxProjectedCount - 1)
    : projectedCount
  const maxIndex = alreadyProjected
    ? Math.max(0, projectedCount - 1)
    : projectedCount >= maxProjectedCount
    ? Math.max(0, maxProjectedCount - 1)
    : projectedCount

  return Math.max(0, Math.min(maxIndex, index ?? defaultIndex))
}

export const deepDiveSurfaceOrderAtom = Atom.make<ReadonlyArray<DeepDiveProjectionPlane>>(deepDiveSurfaceOrderDefault)
  .pipe(
    Atom.keepAlive
  )

export const deepDiveProjectedSurfaceCountAtom = Atom.make<number>(deepDiveProjectedSurfaceCountDefault).pipe(
  Atom.keepAlive
)

export const deepDiveWorkspaceWidthAtom = Atom.make<number>(deepDiveWorkspaceWidthDefaultPx).pipe(Atom.keepAlive)

export const deepDiveMaxProjectedSurfaceCountAtom = Atom.make((get) =>
  maxProjectedSurfaceCountForWorkspaceWidth(get(deepDiveWorkspaceWidthAtom))
)

export const deepDivePanePercentAtom = Atom.make<DeepDivePanePercent>(DeepDivePanePercentDefault).pipe(
  Atom.keepAlive
)

export const deepDiveSecondaryPanePercentAtom = Atom.make<DeepDivePanePercent>(50).pipe(Atom.keepAlive)

export const deepDiveFocusedSurfaceAtom = Atom.make<DeepDiveProjectionPlane>(DeepDiveSurfacePlaneValue.Stage).pipe(
  Atom.keepAlive
)

export const deepDiveDraggedSurfaceAtom = Atom.make<DeepDiveProjectionPlane | null>(null).pipe(Atom.keepAlive)

export const deepDiveDragPointerAtom = Atom.make<DeepDiveDragPointer | null>(null).pipe(Atom.keepAlive)

export const deepDiveDragGhostTargetAtom = Atom.make<DeepDiveDragGhostTarget | null>(null).pipe(Atom.keepAlive)

export const deepDiveDragHoverLotIndexAtom = Atom.make<number | null>(null).pipe(Atom.keepAlive)

export const deepDiveDragHoverHideTargetAtom = Atom.make(false).pipe(Atom.keepAlive)

export const deepDiveProjectedSurfacesAtom = Atom.make((get) => {
  const projectedCount = Math.min(get(deepDiveProjectedSurfaceCountAtom), get(deepDiveMaxProjectedSurfaceCountAtom))

  return projectedSurfaces({
    order: get(deepDiveSurfaceOrderAtom),
    projectedCount
  })
})

export const deepDiveHiddenSurfacesAtom = Atom.make((get) => {
  const order = get(deepDiveSurfaceOrderAtom)
  const projectedCount = Math.min(get(deepDiveProjectedSurfaceCountAtom), get(deepDiveMaxProjectedSurfaceCountAtom))

  return order.slice(projectedCount)
})

export const deepDiveSourceExplorerVisibleAtom = Atom.make(true).pipe(Atom.keepAlive)

export const focusDeepDiveSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const projectedCount = Math.min(
      ctx(deepDiveProjectedSurfaceCountAtom),
      ctx(deepDiveMaxProjectedSurfaceCountAtom)
    )

    if (
      isProjectedSurface({
        order: ctx(deepDiveSurfaceOrderAtom),
        projectedCount,
        surface
      })
    ) {
      ctx.set(deepDiveFocusedSurfaceAtom, surface)
    }
  }
)

export const projectDeepDiveSurfaceAtom = Atom.fnSync<ProjectDeepDiveSurfaceInput>()(
  ({ index, surface }, ctx) => {
    const order = ctx(deepDiveSurfaceOrderAtom)
    const projectedCount = Math.min(
      ctx(deepDiveProjectedSurfaceCountAtom),
      ctx(deepDiveMaxProjectedSurfaceCountAtom)
    )
    const maxProjectedCount = ctx(deepDiveMaxProjectedSurfaceCountAtom)
    const currentIndex = order.indexOf(surface)

    if (currentIndex === -1) {
      return
    }

    const insertionIndex = typeof index === "number"
      ? projectedInsertionIndex({ currentIndex, index, maxProjectedCount, projectedCount })
      : projectedInsertionIndex({ currentIndex, maxProjectedCount, projectedCount })
    const nextOrder = insertSurfaceAt({
      index: insertionIndex,
      order: removeSurface(order, surface),
      surface
    })

    ctx.set(deepDiveSurfaceOrderAtom, nextOrder)
    ctx.set(
      deepDiveProjectedSurfaceCountAtom,
      currentIndex < projectedCount
        ? projectedCount
        : Math.min(maxProjectedCount, clampedProjectedSurfaceCount(projectedCount + 1))
    )
    ctx.set(deepDiveFocusedSurfaceAtom, surface)
  }
)

export const setDeepDiveWorkspaceWidthAtom = Atom.fnSync<number>()(
  (workspaceWidth, ctx) => {
    const nextWorkspaceWidth = Math.max(0, Math.round(workspaceWidth))
    const currentProjectedCount = ctx(deepDiveProjectedSurfaceCountAtom)
    const nextProjectedCount = clampedProjectedSurfaceCountForWorkspaceWidth({
      projectedCount: currentProjectedCount,
      workspaceWidthPx: nextWorkspaceWidth
    })

    ctx.set(deepDiveWorkspaceWidthAtom, nextWorkspaceWidth)

    if (nextProjectedCount === currentProjectedCount) {
      return
    }

    const nextOrder = ctx(deepDiveSurfaceOrderAtom)

    ctx.set(deepDiveProjectedSurfaceCountAtom, nextProjectedCount)
    ctx.set(
      deepDiveFocusedSurfaceAtom,
      nextFocusedSurfaceAfterProjectedCountClamp({
        currentFocusedSurface: ctx(deepDiveFocusedSurfaceAtom),
        nextOrder,
        nextProjectedCount
      })
    )
  }
)

export const setDeepDivePanePercentAtom = Atom.fnSync<number>()(
  (nextPercent, ctx) => {
    ctx.set(deepDivePanePercentAtom, clampedPanePercent(nextPercent))
  }
)

export const setDeepDiveSecondaryPanePercentAtom = Atom.fnSync<number>()(
  (nextPercent, ctx) => {
    ctx.set(deepDiveSecondaryPanePercentAtom, clampedPanePercent(nextPercent))
  }
)

export const reorderDeepDiveProjectedSurfaceAtom = Atom.fnSync<ReorderDeepDiveProjectedSurfaceInput>()(
  ({ index, surface }, ctx) => {
    const order = ctx(deepDiveSurfaceOrderAtom)
    const projectedCount = Math.min(
      ctx(deepDiveProjectedSurfaceCountAtom),
      ctx(deepDiveMaxProjectedSurfaceCountAtom)
    )

    if (!isProjectedSurface({ order, projectedCount, surface })) {
      return
    }

    const nextOrder = insertSurfaceAt({
      index: Math.max(0, Math.min(projectedCount - 1, index)),
      order: removeSurface(order, surface),
      surface
    })

    ctx.set(deepDiveSurfaceOrderAtom, nextOrder)
    ctx.set(deepDiveFocusedSurfaceAtom, surface)
  }
)

export const hideDeepDiveProjectedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const order = ctx(deepDiveSurfaceOrderAtom)
    const projectedCount = Math.min(
      ctx(deepDiveProjectedSurfaceCountAtom),
      ctx(deepDiveMaxProjectedSurfaceCountAtom)
    )
    const currentIndex = order.indexOf(surface)

    if (currentIndex === -1 || currentIndex >= projectedCount || projectedCount <= 1) {
      return
    }

    const nextProjectedCount = clampedProjectedSurfaceCount(projectedCount - 1)
    const nextOrder = [...removeSurface(order, surface), surface]

    ctx.set(deepDiveSurfaceOrderAtom, nextOrder)
    ctx.set(deepDiveProjectedSurfaceCountAtom, nextProjectedCount)
    ctx.set(
      deepDiveFocusedSurfaceAtom,
      nextFocusedSurfaceAfterHide({
        currentFocusedSurface: ctx(deepDiveFocusedSurfaceAtom),
        hiddenIndex: currentIndex,
        hiddenSurface: surface,
        nextOrder,
        nextProjectedCount
      })
    )
  }
)

export const toggleDeepDiveProjectedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const order = ctx(deepDiveSurfaceOrderAtom)
    const projectedCount = Math.min(
      ctx(deepDiveProjectedSurfaceCountAtom),
      ctx(deepDiveMaxProjectedSurfaceCountAtom)
    )

    if (isProjectedSurface({ order, projectedCount, surface })) {
      ctx.set(hideDeepDiveProjectedSurfaceAtom, surface)
      return
    }

    ctx.set(projectDeepDiveSurfaceAtom, { surface })
  }
)

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

export const toggleDeepDiveSourceExplorerVisibleAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveSourceExplorerVisibleAtom, !ctx(deepDiveSourceExplorerVisibleAtom))
  }
)
