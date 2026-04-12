import type { EntryId } from "../../../contracts/entry/id.js"

import type { SurfaceViewExtensionContext } from "./surface-view-extension.js"
import { surfaceViewExtensionFor } from "./surface-view-registry.js"

const surfaceViewFor = (id: EntryId) => surfaceViewExtensionFor(id)

export const interactiveWidgetFor = (id: EntryId) => surfaceViewFor(id).interactiveWidget ?? undefined

export const runLifecycleDiagnosticsSectionsFor = (
  id: EntryId,
  get: SurfaceViewExtensionContext
) => surfaceViewFor(id).diagnosticsSections(get)
