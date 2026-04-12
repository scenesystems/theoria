import { Schema } from "effect"

import type { DeepDiveProjectionSurfaceState } from "./deep-dive-projection-order-state.js"
import { DeepDiveProjectionPlane, deepDiveProjectionSurfaceDescriptorFor } from "./deep-dive-projection.js"
import { DeepDiveProjectionWorkspaceLayout } from "./deep-dive-workspace-layout.js"
import { DeepDivePanePercent } from "./layout.js"

export type DeepDiveProjectionSurfaceInput = {
  readonly pane: unknown
  readonly surface: DeepDiveProjectionSurfaceState
}

export type DeepDiveProjectionPresentationInput = {
  readonly focusedSurface: typeof DeepDiveProjectionPlane.Type
  readonly maxProjectedCount: number
  readonly panePercent: typeof DeepDivePanePercent.Type
  readonly secondaryPanePercent: typeof DeepDivePanePercent.Type
  readonly surfaces: ReadonlyArray<DeepDiveProjectionSurfaceInput>
  readonly workspaceLayout: typeof DeepDiveProjectionWorkspaceLayout.Type
}

export class DeepDiveProjectionSurfacePane extends Schema.Class<DeepDiveProjectionSurfacePane>(
  "DeepDiveProjectionSurfacePane"
)({
  description: Schema.String,
  id: DeepDiveProjectionPlane,
  label: Schema.String,
  pane: Schema.Any
}) {}

export class DeepDiveProjectionSurface extends Schema.Class<DeepDiveProjectionSurface>("DeepDiveProjectionSurface")({
  description: Schema.String,
  focused: Schema.Boolean,
  id: DeepDiveProjectionPlane,
  label: Schema.String,
  pane: Schema.Any,
  position: Schema.NullOr(Schema.Number),
  projected: Schema.Boolean
}) {
  static project({ pane, surface }: DeepDiveProjectionSurfaceInput): DeepDiveProjectionSurface {
    const descriptor = deepDiveProjectionSurfaceDescriptorFor(surface.id)

    return DeepDiveProjectionSurface.make({
      description: descriptor.description,
      focused: surface.focused,
      id: surface.id,
      label: descriptor.label,
      pane,
      position: surface.position,
      projected: surface.projected
    })
  }
}

export class DeepDiveProjectionModel extends Schema.Class<DeepDiveProjectionModel>("DeepDiveProjectionModel")({
  focusedSurface: DeepDiveProjectionPlane,
  maxProjectedCount: Schema.Number,
  panePercent: DeepDivePanePercent,
  secondaryPanePercent: DeepDivePanePercent,
  surfaces: Schema.Array(DeepDiveProjectionSurface),
  workspaceLayout: DeepDiveProjectionWorkspaceLayout
}) {
  static project(input: DeepDiveProjectionPresentationInput): DeepDiveProjectionModel {
    return DeepDiveProjectionModel.make({
      focusedSurface: input.focusedSurface,
      maxProjectedCount: input.maxProjectedCount,
      panePercent: input.panePercent,
      secondaryPanePercent: input.secondaryPanePercent,
      surfaces: input.surfaces.map(DeepDiveProjectionSurface.project),
      workspaceLayout: input.workspaceLayout
    })
  }
}
