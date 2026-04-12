import type { DeepDiveProjectionPlane } from "./deep-dive-projection.js"

import {
  clampedProjectedSurfaceCount,
  clampedProjectedSurfaceCountForWorkspaceWidth,
  DeepDiveProjectionOrderChange,
  DeepDiveProjectionOrderState,
  DeepDiveProjectionSurfaceState,
  insertSurfaceAt,
  isProjectedSurface,
  nextFocusedSurfaceAfterHide,
  nextFocusedSurfaceAfterProjectedCountClamp,
  removeSurface
} from "./deep-dive-projection-order-state.js"

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

export const deepDiveVisibleProjectedSurfaceCount = ({
  maxProjectedCount,
  projectedCount,
  surfaceCount
}: {
  readonly maxProjectedCount: number
  readonly projectedCount: number
  readonly surfaceCount: number
}): number =>
  Math.min(
    maxProjectedCount,
    clampedProjectedSurfaceCount({ surfaceCount, value: projectedCount })
  )

export const deepDiveProjectionOrderState = ({
  focusedSurface,
  maxProjectedCount,
  projectedCount,
  surfaceOrder
}: {
  readonly focusedSurface: DeepDiveProjectionPlane
  readonly maxProjectedCount: number
  readonly projectedCount: number
  readonly surfaceOrder: ReadonlyArray<DeepDiveProjectionPlane>
}): DeepDiveProjectionOrderState => {
  const visibleProjectedCount = deepDiveVisibleProjectedSurfaceCount({
    maxProjectedCount,
    projectedCount,
    surfaceCount: surfaceOrder.length
  })

  return DeepDiveProjectionOrderState.make({
    focusedSurface,
    maxProjectedCount,
    projectedCount,
    surfaceOrder,
    surfaces: surfaceOrder.map((surface, index) =>
      DeepDiveProjectionSurfaceState.make({
        focused: focusedSurface === surface,
        id: surface,
        position: index < visibleProjectedCount ? index : null,
        projected: index < visibleProjectedCount
      })
    ),
    visibleProjectedCount
  })
}

export const deepDiveProjectionSurfaceIsProjected = ({
  order,
  surface
}: {
  readonly order: DeepDiveProjectionOrderState
  readonly surface: DeepDiveProjectionPlane
}): boolean =>
  isProjectedSurface({
    order: order.surfaceOrder,
    projectedCount: order.visibleProjectedCount,
    surface
  })

export const deepDiveProjectionSurfaceCanHide = ({
  order,
  surface
}: {
  readonly order: DeepDiveProjectionOrderState
  readonly surface: DeepDiveProjectionPlane
}): boolean => order.visibleProjectedCount > 1 && deepDiveProjectionSurfaceIsProjected({ order, surface })

export const deepDiveProjectionDropIndex = ({
  index,
  order
}: {
  readonly index: number
  readonly order: DeepDiveProjectionOrderState
}): number => Math.max(0, Math.min(order.visibleProjectedCount - 1, index))

export const deepDiveProjectionOrderProjectSurfaceChange = ({
  index,
  order,
  surface
}: {
  readonly index?: number
  readonly order: DeepDiveProjectionOrderState
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionOrderChange | null => {
  const currentIndex = order.surfaceOrder.indexOf(surface)

  if (currentIndex === -1) {
    return null
  }

  return DeepDiveProjectionOrderChange.make({
    focusedSurface: surface,
    projectedCount: currentIndex < order.visibleProjectedCount
      ? order.projectedCount
      : Math.min(
        order.maxProjectedCount,
        clampedProjectedSurfaceCount({
          surfaceCount: order.surfaceOrder.length,
          value: order.visibleProjectedCount + 1
        })
      ),
    surfaceOrder: insertSurfaceAt({
      index: projectedInsertionIndex({
        currentIndex,
        maxProjectedCount: order.maxProjectedCount,
        projectedCount: order.visibleProjectedCount,
        ...(typeof index === "number" ? { index } : {})
      }),
      order: removeSurface(order.surfaceOrder, surface),
      surface
    })
  })
}

export const deepDiveProjectionOrderReorderSurfaceChange = ({
  index,
  order,
  surface
}: {
  readonly index: number
  readonly order: DeepDiveProjectionOrderState
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionOrderChange | null => {
  if (!deepDiveProjectionSurfaceIsProjected({ order, surface })) {
    return null
  }

  return DeepDiveProjectionOrderChange.make({
    focusedSurface: surface,
    projectedCount: order.projectedCount,
    surfaceOrder: insertSurfaceAt({
      index: deepDiveProjectionDropIndex({ index, order }),
      order: removeSurface(order.surfaceOrder, surface),
      surface
    })
  })
}

export const deepDiveProjectionOrderHideSurfaceChange = ({
  order,
  surface
}: {
  readonly order: DeepDiveProjectionOrderState
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionOrderChange | null => {
  const hiddenIndex = order.surfaceOrder.indexOf(surface)

  if (hiddenIndex === -1 || hiddenIndex >= order.visibleProjectedCount || order.visibleProjectedCount <= 1) {
    return null
  }

  const projectedCount = clampedProjectedSurfaceCount({
    surfaceCount: order.surfaceOrder.length,
    value: order.visibleProjectedCount - 1
  })
  const surfaceOrder = [...removeSurface(order.surfaceOrder, surface), surface]

  return DeepDiveProjectionOrderChange.make({
    focusedSurface: nextFocusedSurfaceAfterHide({
      currentFocusedSurface: order.focusedSurface,
      hiddenIndex,
      hiddenSurface: surface,
      nextOrder: surfaceOrder,
      nextProjectedCount: projectedCount
    }),
    projectedCount,
    surfaceOrder
  })
}

export const deepDiveProjectionOrderViewportChange = ({
  order,
  workspaceWidthPx
}: {
  readonly order: DeepDiveProjectionOrderState
  readonly workspaceWidthPx: number
}): DeepDiveProjectionOrderChange => {
  const projectedCount = clampedProjectedSurfaceCountForWorkspaceWidth({
    projectedCount: order.projectedCount,
    surfaceCount: order.surfaceOrder.length,
    workspaceWidthPx
  })

  return DeepDiveProjectionOrderChange.make({
    focusedSurface: nextFocusedSurfaceAfterProjectedCountClamp({
      currentFocusedSurface: order.focusedSurface,
      nextOrder: order.surfaceOrder,
      nextProjectedCount: projectedCount
    }),
    projectedCount,
    surfaceOrder: order.surfaceOrder
  })
}
