import { defaultProjectionPlaneHint } from "../../../contracts/presentation/surface-runtime-hints.js"

import { noDiagnosticsSections, SurfaceViewExtension } from "./descriptor.js"

export const nullSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: null,
  projectionPlaneHint: defaultProjectionPlaneHint,
  diagnosticsSections: noDiagnosticsSections
})
