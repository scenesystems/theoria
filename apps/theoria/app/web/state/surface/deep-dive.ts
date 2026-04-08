import type { DeepDiveSurfacePlane } from "../../../contracts/presentation/layout.js"
import { DeepDiveSurfacePlaneValue } from "../../../contracts/presentation/layout.js"

export const DeepDiveDiagnosticsPlaneValue = "diagnostics"

export type DeepDiveProjectionPlane = DeepDiveSurfacePlane | typeof DeepDiveDiagnosticsPlaneValue

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
