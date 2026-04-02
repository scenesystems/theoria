import { Match } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import { type DeepDivePanePercent, DeepDiveSurfacePlaneValue } from "../../../contracts/layout.js"
import { DeepDiveDiagnosticsPlaneValue, type DeepDiveProjectionPlane } from "../../state/deep-dive-surface.js"

export type DeepDiveProjectionSurfaceOption = {
  readonly description: string
  readonly focused: boolean
  readonly id: DeepDiveProjectionPlane
  readonly label: string
  readonly position: number | null
  readonly projected: boolean
}

export type DeepDiveProjectionSurface = {
  readonly description: DeepDiveProjectionSurfaceOption["description"]
  readonly focused: DeepDiveProjectionSurfaceOption["focused"]
  readonly id: DeepDiveProjectionSurfaceOption["id"]
  readonly label: DeepDiveProjectionSurfaceOption["label"]
  readonly pane: ReactNode
  readonly position: DeepDiveProjectionSurfaceOption["position"]
  readonly projected: DeepDiveProjectionSurfaceOption["projected"]
}

export type DeepDiveProjectionModel = {
  readonly focusedSurface: DeepDiveProjectionPlane
  readonly maxProjectedCount: number
  readonly panePercent: DeepDivePanePercent
  readonly secondaryPanePercent: DeepDivePanePercent
  readonly surfaces: ReadonlyArray<DeepDiveProjectionSurface>
}

export type DeepDiveProjectionControlModel = {
  readonly focusedSurface: DeepDiveProjectionPlane
  readonly maxProjectedCount: number
  readonly surfaces: ReadonlyArray<DeepDiveProjectionSurfaceOption>
}

export const deepDiveProjectionSurfaceDescriptorFor = (surface: DeepDiveProjectionPlane): {
  readonly description: string
  readonly id: DeepDiveProjectionPlane
  readonly label: string
} =>
  Match.value(surface).pipe(
    Match.withReturnType<{
      readonly description: string
      readonly id: DeepDiveProjectionPlane
      readonly label: string
    }>(),
    Match.when(DeepDiveSurfacePlaneValue.Stage, () => ({
      description: "Controls, runtime cues, and live projections.",
      id: DeepDiveSurfacePlaneValue.Stage,
      label: "Live Stage"
    })),
    Match.when(DeepDiveSurfacePlaneValue.Evidence, () => ({
      description: "Metrics, diagnostics, and reproducible outcomes.",
      id: DeepDiveSurfacePlaneValue.Evidence,
      label: "Evidence"
    })),
    Match.when(DeepDiveSurfacePlaneValue.Source, () => ({
      description: "Prepared and runtime source for the active demo.",
      id: DeepDiveSurfacePlaneValue.Source,
      label: "Source"
    })),
    Match.when(DeepDiveDiagnosticsPlaneValue, () => ({
      description: "Development-only lifecycle telemetry and local driver state.",
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
