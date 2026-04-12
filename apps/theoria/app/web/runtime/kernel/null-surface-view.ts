import { noDiagnosticsSections, SurfaceViewExtension } from "./surface-view-extension.js"

export const nullSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: null,
  diagnosticsSections: noDiagnosticsSections
})
