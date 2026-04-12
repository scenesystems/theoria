import { Schema } from "effect"

import {
  DeepDiveDiagnosticsPlaneValue,
  DeepDiveProjectionPlane as DeepDiveProjectionPlaneSchema,
  type DeepDiveProjectionPlane as DeepDiveProjectionPlaneValue
} from "./deep-dive-projection.js"
import { DeepDiveSurfacePlaneValue } from "./layout.js"

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

export const deepDiveFocusedSurfaceDefault: DeepDiveProjectionPlaneValue = DeepDiveSurfacePlaneValue.Stage

export const deepDiveProjectedSurfaceCountDefault = 2

export const deepDiveWorkspaceWidthDefaultPx = 1200

export const deepDiveProjectionSurfaceOrder = ({
  diagnosticsEnabled
}: {
  readonly diagnosticsEnabled: boolean
}): ReadonlyArray<DeepDiveProjectionPlaneValue> =>
  diagnosticsEnabled
    ? [
      DeepDiveSurfacePlaneValue.Stage,
      DeepDiveSurfacePlaneValue.Evidence,
      DeepDiveSurfacePlaneValue.Source,
      DeepDiveDiagnosticsPlaneValue
    ]
    : [
      DeepDiveSurfacePlaneValue.Stage,
      DeepDiveSurfacePlaneValue.Evidence,
      DeepDiveSurfacePlaneValue.Source
    ]

export const clampedProjectedSurfaceCount = ({
  surfaceCount,
  value
}: {
  readonly surfaceCount: number
  readonly value: number
}): number => Math.max(1, Math.min(surfaceCount, Math.round(value)))

export const maxProjectedSurfaceCountForWorkspaceWidth = (workspaceWidthPx: number): number =>
  projectedSurfaceWorkspaceThresholds.find(({ minWidthPx }) => workspaceWidthPx >= minWidthPx)?.count ?? 1

export const clampedProjectedSurfaceCountForWorkspaceWidth = ({
  projectedCount,
  surfaceCount,
  workspaceWidthPx
}: {
  readonly projectedCount: number
  readonly surfaceCount: number
  readonly workspaceWidthPx: number
}): number =>
  Math.min(
    clampedProjectedSurfaceCount({ surfaceCount, value: projectedCount }),
    maxProjectedSurfaceCountForWorkspaceWidth(workspaceWidthPx)
  )

export const removeSurface = (
  order: ReadonlyArray<DeepDiveProjectionPlaneValue>,
  surface: DeepDiveProjectionPlaneValue
): ReadonlyArray<DeepDiveProjectionPlaneValue> => order.filter((entry) => entry !== surface)

export const insertSurfaceAt = ({
  index,
  order,
  surface
}: {
  readonly index: number
  readonly order: ReadonlyArray<DeepDiveProjectionPlaneValue>
  readonly surface: DeepDiveProjectionPlaneValue
}): ReadonlyArray<DeepDiveProjectionPlaneValue> => [...order.slice(0, index), surface, ...order.slice(index)]

export const projectedSurfaces = ({
  order,
  projectedCount
}: {
  readonly order: ReadonlyArray<DeepDiveProjectionPlaneValue>
  readonly projectedCount: number
}): ReadonlyArray<DeepDiveProjectionPlaneValue> => order.slice(0, projectedCount)

export const isProjectedSurface = ({
  order,
  projectedCount,
  surface
}: {
  readonly order: ReadonlyArray<DeepDiveProjectionPlaneValue>
  readonly projectedCount: number
  readonly surface: DeepDiveProjectionPlaneValue
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
  readonly currentFocusedSurface: DeepDiveProjectionPlaneValue
  readonly hiddenIndex: number
  readonly hiddenSurface: DeepDiveProjectionPlaneValue
  readonly nextOrder: ReadonlyArray<DeepDiveProjectionPlaneValue>
  readonly nextProjectedCount: number
}): DeepDiveProjectionPlaneValue => {
  const nextProjected = projectedSurfaces({
    order: nextOrder,
    projectedCount: nextProjectedCount
  })

  return currentFocusedSurface === hiddenSurface
    ? nextProjected[Math.min(hiddenIndex, nextProjected.length - 1)] ?? nextProjected[0] ?? hiddenSurface
    : currentFocusedSurface
}

export const nextFocusedSurfaceAfterProjectedCountClamp = ({
  currentFocusedSurface,
  nextOrder,
  nextProjectedCount
}: {
  readonly currentFocusedSurface: DeepDiveProjectionPlaneValue
  readonly nextOrder: ReadonlyArray<DeepDiveProjectionPlaneValue>
  readonly nextProjectedCount: number
}): DeepDiveProjectionPlaneValue => {
  const nextProjected = projectedSurfaces({
    order: nextOrder,
    projectedCount: nextProjectedCount
  })
  const focusedIndex = nextOrder.indexOf(currentFocusedSurface)

  return focusedIndex !== -1 && focusedIndex < nextProjectedCount
    ? currentFocusedSurface
    : nextProjected[Math.max(0, Math.min(focusedIndex, nextProjected.length - 1))]
      ?? nextProjected[0]
      ?? currentFocusedSurface
}

export class DeepDiveProjectionSurfaceState extends Schema.Class<DeepDiveProjectionSurfaceState>(
  "DeepDiveProjectionSurfaceState"
)({
  focused: Schema.Boolean,
  id: DeepDiveProjectionPlaneSchema,
  position: Schema.NullOr(Schema.Number),
  projected: Schema.Boolean
}) {}

export class DeepDiveProjectionOrderState extends Schema.Class<DeepDiveProjectionOrderState>(
  "DeepDiveProjectionOrderState"
)({
  focusedSurface: DeepDiveProjectionPlaneSchema,
  maxProjectedCount: Schema.Number,
  projectedCount: Schema.Number,
  surfaceOrder: Schema.Array(DeepDiveProjectionPlaneSchema),
  surfaces: Schema.Array(DeepDiveProjectionSurfaceState),
  visibleProjectedCount: Schema.Number
}) {}

export class DeepDiveProjectionOrderChange extends Schema.Class<DeepDiveProjectionOrderChange>(
  "DeepDiveProjectionOrderChange"
)({
  focusedSurface: DeepDiveProjectionPlaneSchema,
  projectedCount: Schema.Number,
  surfaceOrder: Schema.Array(DeepDiveProjectionPlaneSchema)
}) {}
