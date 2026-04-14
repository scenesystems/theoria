import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { RunRuntimeTelemetryViewModel } from "../../../contracts/presentation/run-runtime-telemetry.js"
import { surfaceRunRuntimeTelemetryViewModelAtom } from "../surface/run-telemetry.js"

export const surfaceRunLifecycleDiagnosticsViewModelAtom: (
  id: EntryId
) => AtomType.Atom<RunRuntimeTelemetryViewModel | null> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunRuntimeTelemetryViewModelAtom(id)))
)
