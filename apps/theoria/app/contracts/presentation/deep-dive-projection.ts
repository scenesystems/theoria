import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { DeepDiveSurfacePlaneValue } from "./layout.js"

export const DeepDiveDiagnosticsPlaneValue = "diagnostics"

export const DeepDiveProjectionPlane = Schema.Literal(
  DeepDiveSurfacePlaneValue.Stage,
  DeepDiveSurfacePlaneValue.Evidence,
  DeepDiveSurfacePlaneValue.Source,
  DeepDiveDiagnosticsPlaneValue
)

export type DeepDiveProjectionPlane = typeof DeepDiveProjectionPlane.Type

export class DeepDiveProjectionSurfaceDescriptor
  extends Schema.Class<DeepDiveProjectionSurfaceDescriptor>("DeepDiveProjectionSurfaceDescriptor")({
    description: Schema.String,
    id: DeepDiveProjectionPlane,
    label: Schema.String
  })
{}

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

export class DeepDiveProjectionControlModel extends Schema.Class<DeepDiveProjectionControlModel>(
  "DeepDiveProjectionControlModel"
)({
  focusedSurface: DeepDiveProjectionPlane,
  maxProjectedCount: Schema.Number,
  surfaces: Schema.Array(DeepDiveProjectionSurfaceOption)
}) {}

export class DeepDiveProjectionMenuTrigger extends Schema.Class<DeepDiveProjectionMenuTrigger>(
  "DeepDiveProjectionMenuTrigger"
)({
  ariaLabel: Schema.String,
  countLabel: Schema.String
}) {}

export const deepDiveProjectionSurfaceActionLabel = (projected: boolean): string => projected ? "Unbind" : "Bind"

export const deepDiveProjectionSurfaceActionAriaLabel = ({
  label,
  projected
}: {
  readonly label: string
  readonly projected: boolean
}): string => `${deepDiveProjectionSurfaceActionLabel(projected)} ${label}`

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

const deepDiveProjectionVisibleSurfaceSummary = (
  surfaces: ReadonlyArray<{ readonly label: string }>
): string => surfaces.length === 0 ? "No surfaces visible." : `${surfaces.map((surface) => surface.label).join(", ")}.`

export const deepDiveProjectionMenuTrigger = (
  projection: DeepDiveProjectionControlModel
): DeepDiveProjectionMenuTrigger => {
  const projected = projectedProjectionSurfaces(projection.surfaces)

  return DeepDiveProjectionMenuTrigger.make({
    ariaLabel: `Projection field: ${projected.length} of ${projection.maxProjectedCount} surfaces visible. ${
      deepDiveProjectionVisibleSurfaceSummary(projected)
    }`,
    countLabel: `${projected.length}/${projection.maxProjectedCount}`
  })
}

export const deepDiveProjectionControlModelFor = <
  T extends {
    readonly focused: boolean
    readonly id: DeepDiveProjectionPlane
    readonly position: number | null
    readonly projected: boolean
  }
>(
  projection: {
    readonly focusedSurface: DeepDiveProjectionPlane
    readonly maxProjectedCount: number
    readonly surfaces: ReadonlyArray<T>
  }
): DeepDiveProjectionControlModel =>
  DeepDiveProjectionControlModel.make({
    focusedSurface: projection.focusedSurface,
    maxProjectedCount: projection.maxProjectedCount,
    surfaces: projection.surfaces.map(({ focused, id, position, projected }) => {
      const descriptor = deepDiveProjectionSurfaceDescriptorFor(id)

      return DeepDiveProjectionSurfaceOption.make({
        description: descriptor.description,
        focused,
        id,
        label: descriptor.label,
        position,
        projected
      })
    })
  })
