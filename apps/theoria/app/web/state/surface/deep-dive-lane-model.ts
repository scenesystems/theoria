import { type DeepDiveProjectionPlane, deepDiveProjectionPlaneOrderDefault } from "./deep-dive.js"

export const deepDiveSurfaceOrderDefault: ReadonlyArray<DeepDiveProjectionPlane> = deepDiveProjectionPlaneOrderDefault

export const deepDiveProjectedSurfaceCountDefault = 2

const projectedSurfaceWorkspaceThresholds: ReadonlyArray<{
  readonly count: number
  readonly minWidthPx: number
}> = [
  {
    count: 3,
    minWidthPx: 1360
  },
  {
    count: 2,
    minWidthPx: 960
  }
]

export const deepDiveWorkspaceWidthDefaultPx = 1200

export const clampedProjectedSurfaceCount = (value: number): number =>
  Math.max(1, Math.min(deepDiveSurfaceOrderDefault.length, Math.round(value)))

export const maxProjectedSurfaceCountForWorkspaceWidth = (workspaceWidthPx: number): number =>
  projectedSurfaceWorkspaceThresholds.find(({ minWidthPx }) => workspaceWidthPx >= minWidthPx)?.count ?? 1

export const clampedProjectedSurfaceCountForWorkspaceWidth = ({
  projectedCount,
  workspaceWidthPx
}: {
  readonly projectedCount: number
  readonly workspaceWidthPx: number
}): number =>
  Math.min(
    clampedProjectedSurfaceCount(projectedCount),
    maxProjectedSurfaceCountForWorkspaceWidth(workspaceWidthPx)
  )

export const removeSurface = (
  order: ReadonlyArray<DeepDiveProjectionPlane>,
  surface: DeepDiveProjectionPlane
): ReadonlyArray<DeepDiveProjectionPlane> => order.filter((entry) => entry !== surface)

export const insertSurfaceAt = ({
  index,
  order,
  surface
}: {
  readonly index: number
  readonly order: ReadonlyArray<DeepDiveProjectionPlane>
  readonly surface: DeepDiveProjectionPlane
}): ReadonlyArray<DeepDiveProjectionPlane> => [...order.slice(0, index), surface, ...order.slice(index)]

export const projectedSurfaces = ({
  order,
  projectedCount
}: {
  readonly order: ReadonlyArray<DeepDiveProjectionPlane>
  readonly projectedCount: number
}): ReadonlyArray<DeepDiveProjectionPlane> => order.slice(0, projectedCount)

export const isProjectedSurface = ({
  order,
  projectedCount,
  surface
}: {
  readonly order: ReadonlyArray<DeepDiveProjectionPlane>
  readonly projectedCount: number
  readonly surface: DeepDiveProjectionPlane
}): boolean => {
  const currentIndex = order.indexOf(surface)

  return currentIndex !== -1 && currentIndex < projectedCount
}

export const nextFocusedSurfaceAfterHide = ({
  currentFocusedSurface,
  hiddenIndex,
  hiddenSurface,
  nextOrder,
  nextProjectedCount
}: {
  readonly currentFocusedSurface: DeepDiveProjectionPlane
  readonly hiddenIndex: number
  readonly hiddenSurface: DeepDiveProjectionPlane
  readonly nextOrder: ReadonlyArray<DeepDiveProjectionPlane>
  readonly nextProjectedCount: number
}): DeepDiveProjectionPlane => {
  const nextProjectedSurfaces = projectedSurfaces({
    order: nextOrder,
    projectedCount: nextProjectedCount
  })

  return currentFocusedSurface === hiddenSurface
    ? nextProjectedSurfaces[Math.min(hiddenIndex, nextProjectedSurfaces.length - 1)]
      ?? nextProjectedSurfaces[0]
      ?? hiddenSurface
    : currentFocusedSurface
}

export const nextFocusedSurfaceAfterProjectedCountClamp = ({
  currentFocusedSurface,
  nextOrder,
  nextProjectedCount
}: {
  readonly currentFocusedSurface: DeepDiveProjectionPlane
  readonly nextOrder: ReadonlyArray<DeepDiveProjectionPlane>
  readonly nextProjectedCount: number
}): DeepDiveProjectionPlane => {
  const nextProjectedSurfaces = projectedSurfaces({
    order: nextOrder,
    projectedCount: nextProjectedCount
  })
  const focusedIndex = nextOrder.indexOf(currentFocusedSurface)

  return focusedIndex !== -1 && focusedIndex < nextProjectedCount
    ? currentFocusedSurface
    : nextProjectedSurfaces[Math.max(0, Math.min(focusedIndex, nextProjectedSurfaces.length - 1))]
      ?? nextProjectedSurfaces[0]
      ?? currentFocusedSurface
}
