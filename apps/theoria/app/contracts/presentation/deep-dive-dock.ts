import { Schema } from "effect"
import * as Arr from "effect/Array"

import {
  type DeepDiveProjectionControlModel,
  type DeepDiveProjectionPlane,
  DeepDiveProjectionSurfaceOption,
  hiddenProjectionSurfaces,
  projectedProjectionSurfaces
} from "./deep-dive-projection.js"

export class DeepDiveProjectionDockHeading extends Schema.Class<DeepDiveProjectionDockHeading>(
  "DeepDiveProjectionDockHeading"
)({
  detail: Schema.String,
  text: Schema.String
}) {}

export class DeepDiveProjectionDockSlot extends Schema.Class<DeepDiveProjectionDockSlot>("DeepDiveProjectionDockSlot")({
  active: Schema.Boolean,
  index: Schema.Number,
  option: Schema.NullOr(DeepDiveProjectionSurfaceOption)
}) {}

export class DeepDiveProjectionDockModel extends Schema.Class<DeepDiveProjectionDockModel>(
  "DeepDiveProjectionDockModel"
)({
  draggedSurfaceOption: Schema.NullOr(DeepDiveProjectionSurfaceOption),
  hidden: Schema.Array(DeepDiveProjectionSurfaceOption),
  projectIndex: Schema.Number,
  projectedCount: Schema.Number,
  projectedHeading: DeepDiveProjectionDockHeading,
  projectedSlots: Schema.Array(DeepDiveProjectionDockSlot),
  showHideOverlay: Schema.Boolean,
  showHideTarget: Schema.Boolean,
  showLibrary: Schema.Boolean
}) {}

export const deepDiveProjectionDockAvailableHeading = () => ({
  detail: "Bind a surface into the open slot or drag it upward.",
  text: "Available surfaces"
})

export const deepDiveProjectionDockEmptySlotDetail = (active: boolean): string =>
  active ? "Release to bind here" : "Bind a surface here from the list below"

export const deepDiveProjectionDockHideLabel = (): string => "Drop to unbind"

export const deepDiveProjectionDockProjectedHeading = ({
  hiddenCount,
  projectedCount
}: {
  readonly hiddenCount: number
  readonly projectedCount: number
}) => ({
  detail: hiddenCount === 0
    ? `${projectedCount} bound · drag to reorder`
    : `${projectedCount} bound · one slot open`,
  text: "Projected surfaces"
})

export const deepDiveProjectionDockSlotLabel = (): string => "Open slot"

export const deepDiveProjectionDockModel = ({
  draggedSurface,
  hoveredLotIndex,
  projection
}: {
  readonly draggedSurface: DeepDiveProjectionPlane | null
  readonly hoveredLotIndex: number | null
  readonly projection: DeepDiveProjectionControlModel
}): DeepDiveProjectionDockModel => {
  const projected = projectedProjectionSurfaces(projection.surfaces)
  const hidden = hiddenProjectionSurfaces(projection.surfaces)
  const draggingProjectedSurface = projected.some((surface) => surface.id === draggedSurface)
  const visibleLotCount = Math.min(
    projection.maxProjectedCount,
    projected.length + (hidden.length > 0 ? 1 : 0)
  )
  const focusedProjectedIndex = projected.find((surface) => surface.focused)?.position ?? projected.at(-1)?.position ??
    0
  const projectIndex = projected.length < projection.maxProjectedCount ? projected.length : focusedProjectedIndex

  return DeepDiveProjectionDockModel.make({
    draggedSurfaceOption: projection.surfaces.find((surface) => surface.id === draggedSurface) ?? null,
    hidden,
    projectIndex,
    projectedCount: projected.length,
    projectedHeading: DeepDiveProjectionDockHeading.make(
      deepDiveProjectionDockProjectedHeading({
        hiddenCount: hidden.length,
        projectedCount: projected.length
      })
    ),
    projectedSlots: visibleLotCount === 0
      ? []
      : Arr.map(Arr.range(0, visibleLotCount - 1), (index) =>
        DeepDiveProjectionDockSlot.make({
          active: hoveredLotIndex === index,
          index,
          option: projected[index] ?? null
        })),
    showHideOverlay: draggingProjectedSurface && projected.length > 1 && hidden.length === 0,
    showHideTarget: draggingProjectedSurface && projected.length > 1,
    showLibrary: hidden.length > 0
  })
}
