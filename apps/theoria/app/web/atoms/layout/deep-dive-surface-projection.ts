import { Atom } from "@effect-atom/atom"

import { DeepDiveSurfacePlaneValue } from "../../../contracts/presentation/layout.js"
import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"
import {
  clampedProjectedSurfaceCount,
  deepDiveProjectedSurfaceCountDefault,
  deepDiveSurfaceOrderDefault,
  insertSurfaceAt,
  isProjectedSurface,
  nextFocusedSurfaceAfterHide,
  removeSurface
} from "./deep-dive-model.js"
import { deepDiveMaxProjectedSurfaceCountAtom } from "./deep-dive-viewport-state.js"

type ProjectDeepDiveSurfaceInput = {
  readonly index?: number
  readonly surface: DeepDiveProjectionPlane
}

type ReorderDeepDiveProjectedSurfaceInput = {
  readonly index: number
  readonly surface: DeepDiveProjectionPlane
}

const visibleProjectedCount = ({
  maxProjectedCount,
  projectedCount
}: {
  readonly maxProjectedCount: number
  readonly projectedCount: number
}): number => Math.min(projectedCount, maxProjectedCount)

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
  .pipe(Atom.keepAlive)

export const deepDiveProjectedSurfaceCountAtom = Atom.make<number>(deepDiveProjectedSurfaceCountDefault).pipe(
  Atom.keepAlive
)

export const deepDiveFocusedSurfaceAtom = Atom.make<DeepDiveProjectionPlane>(DeepDiveSurfacePlaneValue.Stage).pipe(
  Atom.keepAlive
)

export const focusDeepDiveSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const projectedCount = visibleProjectedCount({
      maxProjectedCount: ctx(deepDiveMaxProjectedSurfaceCountAtom),
      projectedCount: ctx(deepDiveProjectedSurfaceCountAtom)
    })

    if (isProjectedSurface({ order: ctx(deepDiveSurfaceOrderAtom), projectedCount, surface })) {
      ctx.set(deepDiveFocusedSurfaceAtom, surface)
    }
  }
)

export const projectDeepDiveSurfaceAtom = Atom.fnSync<ProjectDeepDiveSurfaceInput>()(
  ({ index, surface }, ctx) => {
    const order = ctx(deepDiveSurfaceOrderAtom)
    const maxProjectedCount = ctx(deepDiveMaxProjectedSurfaceCountAtom)
    const projectedCount = visibleProjectedCount({
      maxProjectedCount,
      projectedCount: ctx(deepDiveProjectedSurfaceCountAtom)
    })
    const currentIndex = order.indexOf(surface)

    if (currentIndex === -1) {
      return
    }

    const nextOrder = insertSurfaceAt({
      index: typeof index === "number"
        ? projectedInsertionIndex({ currentIndex, index, maxProjectedCount, projectedCount })
        : projectedInsertionIndex({ currentIndex, maxProjectedCount, projectedCount }),
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

export const reorderDeepDiveProjectedSurfaceAtom = Atom.fnSync<ReorderDeepDiveProjectedSurfaceInput>()(
  ({ index, surface }, ctx) => {
    const order = ctx(deepDiveSurfaceOrderAtom)
    const projectedCount = visibleProjectedCount({
      maxProjectedCount: ctx(deepDiveMaxProjectedSurfaceCountAtom),
      projectedCount: ctx(deepDiveProjectedSurfaceCountAtom)
    })

    if (!isProjectedSurface({ order, projectedCount, surface })) {
      return
    }

    ctx.set(
      deepDiveSurfaceOrderAtom,
      insertSurfaceAt({
        index: Math.max(0, Math.min(projectedCount - 1, index)),
        order: removeSurface(order, surface),
        surface
      })
    )
    ctx.set(deepDiveFocusedSurfaceAtom, surface)
  }
)

export const hideDeepDiveProjectedSurfaceAtom = Atom.fnSync<DeepDiveProjectionPlane>()(
  (surface, ctx) => {
    const order = ctx(deepDiveSurfaceOrderAtom)
    const projectedCount = visibleProjectedCount({
      maxProjectedCount: ctx(deepDiveMaxProjectedSurfaceCountAtom),
      projectedCount: ctx(deepDiveProjectedSurfaceCountAtom)
    })
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
    const projectedCount = visibleProjectedCount({
      maxProjectedCount: ctx(deepDiveMaxProjectedSurfaceCountAtom),
      projectedCount: ctx(deepDiveProjectedSurfaceCountAtom)
    })

    if (isProjectedSurface({ order: ctx(deepDiveSurfaceOrderAtom), projectedCount, surface })) {
      ctx.set(hideDeepDiveProjectedSurfaceAtom, surface)
      return
    }

    ctx.set(projectDeepDiveSurfaceAtom, { surface })
  }
)
