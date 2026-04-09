import {
  DeepDiveProjectionLaneChange,
  DeepDiveProjectionLaneState,
  DeepDiveProjectionSurfaceState
} from "./deep-dive-projection-lane-state.js"
import type { DeepDiveProjectionPlane } from "./deep-dive.js"

import {
  clampedProjectedSurfaceCount,
  clampedProjectedSurfaceCountForWorkspaceWidth,
  insertSurfaceAt,
  isProjectedSurface,
  nextFocusedSurfaceAfterHide,
  nextFocusedSurfaceAfterProjectedCountClamp,
  removeSurface
} from "./deep-dive-lane-model.js"

export {
  DeepDiveProjectionLaneChange,
  DeepDiveProjectionLaneState,
  DeepDiveProjectionSurfaceState
} from "./deep-dive-projection-lane-state.js"

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
  projectedCount
}: {
  readonly maxProjectedCount: number
  readonly projectedCount: number
}): number => Math.min(projectedCount, maxProjectedCount)

export const deepDiveProjectionLaneState = ({
  focusedSurface,
  maxProjectedCount,
  projectedCount,
  surfaceOrder
}: {
  readonly focusedSurface: DeepDiveProjectionPlane
  readonly maxProjectedCount: number
  readonly projectedCount: number
  readonly surfaceOrder: ReadonlyArray<DeepDiveProjectionPlane>
}): DeepDiveProjectionLaneState => {
  const visibleProjectedCount = deepDiveVisibleProjectedSurfaceCount({ maxProjectedCount, projectedCount })

  return DeepDiveProjectionLaneState.make({
    focusedSurface,
    maxProjectedCount,
    projectedCount,
    surfaceOrder,
    surfaces: surfaceOrder.map((surface, index) => ({
      focused: focusedSurface === surface,
      id: surface,
      position: index < visibleProjectedCount ? index : null,
      projected: index < visibleProjectedCount
    })).map((surface) => DeepDiveProjectionSurfaceState.make(surface)),
    visibleProjectedCount
  })
}

export const deepDiveProjectionSurfaceIsProjected = ({
  lane,
  surface
}: {
  readonly lane: DeepDiveProjectionLaneState
  readonly surface: DeepDiveProjectionPlane
}): boolean =>
  isProjectedSurface({
    order: lane.surfaceOrder,
    projectedCount: lane.visibleProjectedCount,
    surface
  })

export const deepDiveProjectionSurfaceCanHide = ({
  lane,
  surface
}: {
  readonly lane: DeepDiveProjectionLaneState
  readonly surface: DeepDiveProjectionPlane
}): boolean => lane.visibleProjectedCount > 1 && deepDiveProjectionSurfaceIsProjected({ lane, surface })

export const deepDiveProjectionDropIndex = ({
  index,
  lane
}: {
  readonly index: number
  readonly lane: DeepDiveProjectionLaneState
}): number => Math.max(0, Math.min(lane.visibleProjectedCount - 1, index))

export const deepDiveProjectionLaneProjectSurfaceChange = ({
  index,
  lane,
  surface
}: {
  readonly index?: number
  readonly lane: DeepDiveProjectionLaneState
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionLaneChange | null => {
  const currentIndex = lane.surfaceOrder.indexOf(surface)

  if (currentIndex === -1) {
    return null
  }

  return DeepDiveProjectionLaneChange.make({
    focusedSurface: surface,
    projectedCount: currentIndex < lane.visibleProjectedCount
      ? lane.projectedCount
      : Math.min(lane.maxProjectedCount, clampedProjectedSurfaceCount(lane.visibleProjectedCount + 1)),
    surfaceOrder: insertSurfaceAt({
      index: projectedInsertionIndex({
        currentIndex,
        maxProjectedCount: lane.maxProjectedCount,
        projectedCount: lane.visibleProjectedCount,
        ...(typeof index === "number" ? { index } : {})
      }),
      order: removeSurface(lane.surfaceOrder, surface),
      surface
    })
  })
}

export const deepDiveProjectionLaneReorderSurfaceChange = ({
  index,
  lane,
  surface
}: {
  readonly index: number
  readonly lane: DeepDiveProjectionLaneState
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionLaneChange | null => {
  if (!deepDiveProjectionSurfaceIsProjected({ lane, surface })) {
    return null
  }

  return DeepDiveProjectionLaneChange.make({
    focusedSurface: surface,
    projectedCount: lane.projectedCount,
    surfaceOrder: insertSurfaceAt({
      index: deepDiveProjectionDropIndex({ index, lane }),
      order: removeSurface(lane.surfaceOrder, surface),
      surface
    })
  })
}

export const deepDiveProjectionLaneHideSurfaceChange = ({
  lane,
  surface
}: {
  readonly lane: DeepDiveProjectionLaneState
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionLaneChange | null => {
  const hiddenIndex = lane.surfaceOrder.indexOf(surface)

  if (hiddenIndex === -1 || hiddenIndex >= lane.visibleProjectedCount || lane.visibleProjectedCount <= 1) {
    return null
  }

  const projectedCount = clampedProjectedSurfaceCount(lane.visibleProjectedCount - 1)
  const surfaceOrder = [...removeSurface(lane.surfaceOrder, surface), surface]

  return DeepDiveProjectionLaneChange.make({
    focusedSurface: nextFocusedSurfaceAfterHide({
      currentFocusedSurface: lane.focusedSurface,
      hiddenIndex,
      hiddenSurface: surface,
      nextOrder: surfaceOrder,
      nextProjectedCount: projectedCount
    }),
    projectedCount,
    surfaceOrder
  })
}

export const deepDiveProjectionLaneViewportChange = ({
  lane,
  workspaceWidthPx
}: {
  readonly lane: DeepDiveProjectionLaneState
  readonly workspaceWidthPx: number
}): DeepDiveProjectionLaneChange => {
  const projectedCount = clampedProjectedSurfaceCountForWorkspaceWidth({
    projectedCount: lane.projectedCount,
    workspaceWidthPx
  })

  return DeepDiveProjectionLaneChange.make({
    focusedSurface: nextFocusedSurfaceAfterProjectedCountClamp({
      currentFocusedSurface: lane.focusedSurface,
      nextOrder: lane.surfaceOrder,
      nextProjectedCount: projectedCount
    }),
    projectedCount,
    surfaceOrder: lane.surfaceOrder
  })
}
