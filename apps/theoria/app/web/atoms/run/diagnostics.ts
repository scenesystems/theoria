import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import { runLifecycleDiagnosticsSectionsFor } from "../../runtime/surface-view-extension.js"
import { type RunRuntimeTelemetryViewModel, surfaceRunRuntimeTelemetryViewModelAtom } from "../surface/state.js"

export const surfaceRunLifecycleDiagnosticsViewModelAtom: (
  id: EntryId
) => AtomType.Atom<RunRuntimeTelemetryViewModel | null> = Atom.family(
  (id: EntryId) =>
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
