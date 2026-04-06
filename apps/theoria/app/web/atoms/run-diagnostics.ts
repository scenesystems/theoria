import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { Id } from "../../contracts/id.js"
import { runLifecycleDiagnosticsSectionsFor } from "../runtime/surface-view-extension.js"
import { type RunRuntimeTelemetryViewModel, surfaceRunRuntimeTelemetryViewModelAtom } from "./surface.js"

export const surfaceRunLifecycleDiagnosticsViewModelAtom: (
  id: Id
) => AtomType.Atom<RunRuntimeTelemetryViewModel | null> = Atom.family(
  (id: Id) =>
    Atom.make((get: AtomType.Context) => {
      const base = get(surfaceRunRuntimeTelemetryViewModelAtom(id))

      if (base === null) {
        return null
      }

      const localSections = runLifecycleDiagnosticsSectionsFor(id, get)

      return {
        sections: [...base.sections, ...localSections]
      }
    })
)
