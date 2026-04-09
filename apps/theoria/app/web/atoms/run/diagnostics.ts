import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import {
  type RunRuntimeTelemetryViewModel,
  runRuntimeTelemetryViewModel
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import { runLifecycleDiagnosticsSectionsFor } from "../../runtime/kernel/surface-view.js"
import { surfaceRunRuntimeTelemetryViewModelAtom } from "../surface/run-telemetry.js"

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

      return runRuntimeTelemetryViewModel([...base.sections, ...localSections])
    })
)
