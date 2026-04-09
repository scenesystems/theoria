import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { DeepDivePanePercent, DeepDiveSurfacePlaneValue } from "../../../contracts/presentation/layout.js"
import { DeepDiveProjectionWorkspaceLayout } from "../../state/surface/deep-dive-workspace-layout.js"
import { DeepDiveDiagnosticsPlaneValue, DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"

export class DeepDiveProjectionSurfaceOption extends Schema.Class<DeepDiveProjectionSurfaceOption>(
  "DeepDiveProjectionSurfaceOption"
)({
  description: Schema.String,
  focused: Schema.Boolean,
  id: DeepDiveProjectionPlane,
  label: Schema.String,
  position: Schema.NullOr(Schema.Number),
  projected: Schema.Boolean
}) {}

export class DeepDiveProjectionSurface extends Schema.Class<DeepDiveProjectionSurface>("DeepDiveProjectionSurface")({
  description: Schema.String,
  focused: Schema.Boolean,
  id: DeepDiveProjectionPlane,
  label: Schema.String,
  pane: Schema.Any,
  position: Schema.NullOr(Schema.Number),
  projected: Schema.Boolean
}) {}

export class DeepDiveProjectionSurfaceDescriptor
  extends Schema.Class<DeepDiveProjectionSurfaceDescriptor>("DeepDiveProjectionSurfaceDescriptor")({
    description: Schema.String,
    id: DeepDiveProjectionPlane,
    label: Schema.String
  })
{}

export class DeepDiveProjectionSurfacePane extends Schema.Class<DeepDiveProjectionSurfacePane>(
  "DeepDiveProjectionSurfacePane"
)({
  description: Schema.String,
  id: DeepDiveProjectionPlane,
  label: Schema.String,
  pane: Schema.Any
}) {}

export class DeepDiveProjectionModel extends Schema.Class<DeepDiveProjectionModel>("DeepDiveProjectionModel")({
  focusedSurface: DeepDiveProjectionPlane,
  maxProjectedCount: Schema.Number,
  panePercent: DeepDivePanePercent,
  secondaryPanePercent: DeepDivePanePercent,
  surfaces: Schema.Array(DeepDiveProjectionSurface),
  workspaceLayout: DeepDiveProjectionWorkspaceLayout
}) {}

export class DeepDiveProjectionControlModel extends Schema.Class<DeepDiveProjectionControlModel>(
  "DeepDiveProjectionControlModel"
)({
  focusedSurface: DeepDiveProjectionPlane,
  maxProjectedCount: Schema.Number,
  surfaces: Schema.Array(DeepDiveProjectionSurfaceOption)
}) {}

export const deepDiveProjectionControlModelFor = (
  projection: DeepDiveProjectionModel
): DeepDiveProjectionControlModel =>
  DeepDiveProjectionControlModel.make({
    focusedSurface: projection.focusedSurface,
    maxProjectedCount: projection.maxProjectedCount,
    surfaces: projection.surfaces.map(({ description, focused, id, label, position, projected }) =>
      DeepDiveProjectionSurfaceOption.make({ description, focused, id, label, position, projected })
    )
  })

export const projectionSurfaceOrdinalLabel = (projectionIndex: number | null): string | null =>
  projectionIndex === null ? null : `P${projectionIndex + 1}`

export const deepDiveProjectionSurfaceDescriptorFor = (
  surface: DeepDiveProjectionPlane
): DeepDiveProjectionSurfaceDescriptor =>
  Match.value(surface).pipe(
    Match.withReturnType<DeepDiveProjectionSurfaceDescriptor>(),
    Match.when(DeepDiveSurfacePlaneValue.Stage, () =>
      DeepDiveProjectionSurfaceDescriptor.make({
        description: "Controls, runtime cues, and live projections.",
        id: DeepDiveSurfacePlaneValue.Stage,
        label: "Live Stage"
      })),
    Match.when(DeepDiveSurfacePlaneValue.Evidence, () =>
      DeepDiveProjectionSurfaceDescriptor.make({
        description: "Metrics, diagnostics, and reproducible outcomes.",
        id: DeepDiveSurfacePlaneValue.Evidence,
        label: "Evidence"
      })),
    Match.when(DeepDiveSurfacePlaneValue.Source, () =>
      DeepDiveProjectionSurfaceDescriptor.make({
        description: "Prepared and runtime source for the active study surface.",
        id: DeepDiveSurfacePlaneValue.Source,
        label: "Source"
      })),
    Match.when(DeepDiveDiagnosticsPlaneValue, () =>
      DeepDiveProjectionSurfaceDescriptor.make({
        description: "Development-only lifecycle telemetry and canonical-frame reactor state.",
        id: DeepDiveDiagnosticsPlaneValue,
        label: "Diagnostics"
      })),
    Match.exhaustive
  )

const positionValue = ({
  projected,
  position
}: {
  readonly position: number | null
  readonly projected: boolean
}): number =>
  projected
    ? position ?? Number.MAX_SAFE_INTEGER
    : Number.MAX_SAFE_INTEGER

export const orderedProjectionSurfaces = <
  T extends {
    readonly position: number | null
    readonly projected: boolean
  }
>(
  surfaces: ReadonlyArray<T>
): ReadonlyArray<T> => Arr.fromIterable(surfaces).sort((left, right) => positionValue(left) - positionValue(right))

export const projectedProjectionSurfaces = <
  T extends {
    readonly position: number | null
    readonly projected: boolean
  }
>(
  surfaces: ReadonlyArray<T>
): ReadonlyArray<T> => orderedProjectionSurfaces(surfaces).filter((surface) => surface.projected)

export const hiddenProjectionSurfaces = <T extends { readonly projected: boolean }>(
  surfaces: ReadonlyArray<T>
): ReadonlyArray<T> => surfaces.filter((surface) => !surface.projected)
