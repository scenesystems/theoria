import { Schema } from "effect"

import { DeepDiveSurfacePlaneValue } from "../../../contracts/presentation/layout.js"

export const DeepDiveDiagnosticsPlaneValue = "diagnostics"

export const DeepDiveProjectionPlane = Schema.Literal(
  DeepDiveSurfacePlaneValue.Stage,
  DeepDiveSurfacePlaneValue.Evidence,
  DeepDiveSurfacePlaneValue.Source,
  DeepDiveDiagnosticsPlaneValue
)

export type DeepDiveProjectionPlane = typeof DeepDiveProjectionPlane.Type

export const diagnosticsProjectionEnabled = import.meta.env.DEV

export const deepDiveProjectionPlaneOrderDefault: ReadonlyArray<DeepDiveProjectionPlane> = diagnosticsProjectionEnabled
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
