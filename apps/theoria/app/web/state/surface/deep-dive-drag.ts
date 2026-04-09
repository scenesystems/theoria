import { Schema } from "effect"

import {
  deepDiveProjectionDropIndex,
  type DeepDiveProjectionLaneChange,
  deepDiveProjectionLaneHideSurfaceChange,
  deepDiveProjectionLaneProjectSurfaceChange,
  deepDiveProjectionLaneReorderSurfaceChange,
  type DeepDiveProjectionLaneState,
  deepDiveProjectionSurfaceCanHide,
  deepDiveProjectionSurfaceIsProjected
} from "./deep-dive-projection-lane.js"
import { DeepDiveProjectionPlane } from "./deep-dive.js"

export const DeepDiveDragPointer = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number
})

export type DeepDiveDragPointer = typeof DeepDiveDragPointer.Type

export const DeepDiveDragGhostTarget = Schema.Struct({
  width: Schema.Number,
  x: Schema.Number,
  y: Schema.Number
})

export type DeepDiveDragGhostTarget = typeof DeepDiveDragGhostTarget.Type

export const DeepDiveDragState = Schema.Struct({
  draggedSurface: Schema.NullOr(DeepDiveProjectionPlane),
  dragGhostTarget: Schema.NullOr(DeepDiveDragGhostTarget),
  dragPointer: Schema.NullOr(DeepDiveDragPointer),
  hoveredHideTarget: Schema.Boolean,
  hoveredLotIndex: Schema.NullOr(Schema.Number)
})

export type DeepDiveDragState = typeof DeepDiveDragState.Type

export class ClearDeepDiveDragReleaseAction extends Schema.TaggedClass<ClearDeepDiveDragReleaseAction>()(
  "ClearDeepDiveDrag",
  {}
) {}

export class DropDeepDiveDragSurfaceReleaseAction
  extends Schema.TaggedClass<DropDeepDiveDragSurfaceReleaseAction>()("DropDeepDiveDragSurface", {
    index: Schema.Number
  })
{}

export class HideDeepDiveDragSurfaceReleaseAction
  extends Schema.TaggedClass<HideDeepDiveDragSurfaceReleaseAction>()("HideDeepDiveDragSurface", {})
{}

export const DeepDiveDragReleaseAction = Schema.Union(
  ClearDeepDiveDragReleaseAction,
  DropDeepDiveDragSurfaceReleaseAction,
  HideDeepDiveDragSurfaceReleaseAction
)

export type DeepDiveDragReleaseAction = typeof DeepDiveDragReleaseAction.Type

export const emptyDeepDiveDragState: DeepDiveDragState = {
  draggedSurface: null,
  dragGhostTarget: null,
  dragPointer: null,
  hoveredHideTarget: false,
  hoveredLotIndex: null
}

export const clearDeepDiveDragState = (): DeepDiveDragState => emptyDeepDiveDragState

export const startDeepDiveDragState = (surface: DeepDiveProjectionPlane): DeepDiveDragState => ({
  ...emptyDeepDiveDragState,
  draggedSurface: surface
})

export const deepDiveDragStateWithDraggedSurface = ({
  state,
  surface
}: {
  readonly state: DeepDiveDragState
  readonly surface: DeepDiveProjectionPlane | null
}): DeepDiveDragState => ({
  ...state,
  draggedSurface: surface
})

export const deepDiveDragStateWithGhostTarget = ({
  state,
  target
}: {
  readonly state: DeepDiveDragState
  readonly target: DeepDiveDragGhostTarget | null
}): DeepDiveDragState => ({
  ...state,
  dragGhostTarget: target
})

export const deepDiveDragStateWithPointer = ({
  pointer,
  state
}: {
  readonly pointer: DeepDiveDragPointer | null
  readonly state: DeepDiveDragState
}): DeepDiveDragState => ({
  ...state,
  dragPointer: pointer
})

export const deepDiveDragStateWithHoveredLotIndex = ({
  index,
  state
}: {
  readonly index: number | null
  readonly state: DeepDiveDragState
}): DeepDiveDragState => ({
  ...state,
  hoveredHideTarget: index === null ? state.hoveredHideTarget : false,
  hoveredLotIndex: index
})

export const deepDiveDragStateWithHoveredHideTarget = ({
  active,
  state
}: {
  readonly active: boolean
  readonly state: DeepDiveDragState
}): DeepDiveDragState => ({
  ...state,
  hoveredHideTarget: active,
  hoveredLotIndex: active ? null : state.hoveredLotIndex
})

export const deepDiveDragReleaseAction = (state: DeepDiveDragState): DeepDiveDragReleaseAction =>
  state.hoveredHideTarget
    ? HideDeepDiveDragSurfaceReleaseAction.make({})
    : state.hoveredLotIndex === null
    ? ClearDeepDiveDragReleaseAction.make({})
    : DropDeepDiveDragSurfaceReleaseAction.make({ index: state.hoveredLotIndex })

export const deepDiveProjectionLaneDropSurfaceChange = ({
  index,
  lane,
  state
}: {
  readonly index: number
  readonly lane: DeepDiveProjectionLaneState
  readonly state: DeepDiveDragState
}): DeepDiveProjectionLaneChange | null => {
  const surface = state.draggedSurface

  if (surface === null) {
    return null
  }

  return deepDiveProjectionSurfaceIsProjected({ lane, surface })
    ? deepDiveProjectionLaneReorderSurfaceChange({
      index: deepDiveProjectionDropIndex({ index, lane }),
      lane,
      surface
    })
    : deepDiveProjectionLaneProjectSurfaceChange({ index, lane, surface })
}

export const deepDiveProjectionLaneHideDraggedSurfaceChange = ({
  lane,
  state
}: {
  readonly lane: DeepDiveProjectionLaneState
  readonly state: DeepDiveDragState
}): DeepDiveProjectionLaneChange | null => {
  const surface = state.draggedSurface

  return surface === null || !deepDiveProjectionSurfaceCanHide({ lane, surface })
    ? null
    : deepDiveProjectionLaneHideSurfaceChange({ lane, surface })
}
