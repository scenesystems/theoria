import { defaultProjectionPlaneHint, noDiagnosticsSections, SurfaceViewExtension } from "./descriptor.js"

export const nullSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: null,
  projectionPlaneHint: defaultProjectionPlaneHint,
  diagnosticsSections: noDiagnosticsSections
})
