import type { EntryId } from "../../../contracts/entry/id.js"

import type { ProjectionPlaneHint, SurfaceViewExtensionContext, TabHint } from "./descriptor.js"
import { surfaceViewExtensionFor } from "./surface-view-registry.js"

const surfaceViewFor = (id: EntryId) => surfaceViewExtensionFor(id)

export const projectionPlaneHintFor = (id: EntryId): ProjectionPlaneHint => surfaceViewFor(id).projectionPlaneHint

export const tabHintFor = (id: EntryId): TabHint => {
  const projectionPlaneHint = projectionPlaneHintFor(id)

  return {
    interactive: projectionPlaneHint.stage,
    evidence: projectionPlaneHint.evidence
  }
}

export const interactiveWidgetFor = (id: EntryId) => surfaceViewFor(id).interactiveWidget ?? undefined

export const runLifecycleDiagnosticsSectionsFor = (
  id: EntryId,
  get: SurfaceViewExtensionContext
) => surfaceViewFor(id).diagnosticsSections(get)
