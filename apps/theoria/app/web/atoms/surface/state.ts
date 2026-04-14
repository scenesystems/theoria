import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { RunData } from "../../../contracts/study/run.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { ChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import { type LocalProjectionScript, type LocalRunFrame, type RunState } from "../../state/run/types.js"
import { initialSurfaceState, type PreloadState, type SurfaceState } from "../../state/surface/state.js"

const runIsActive = (run: RunState): boolean => run._tag !== "RunIdle"

export const surfaceAtom: (id: EntryId) => AtomType.Writable<SurfaceState> = Atom.family(
  (id: EntryId) => Atom.make(initialSurfaceState(id)).pipe(Atom.keepAlive)
)

export const surfacePreloadStateAtom: (id: EntryId) => AtomType.Atom<PreloadState> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceAtom(id)).preload)
)

export const surfaceRunStateAtom: (id: EntryId) => AtomType.Atom<RunState> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceAtom(id)).run)
)

export const surfaceDraftAtom: (id: EntryId) => AtomType.Atom<SurfaceState["draft"]> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceAtom(id)).draft)
)

export const surfaceRunDraftAtom: (id: EntryId) => AtomType.Atom<RunState["session"]["draft"]> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.draft)
)

export const surfaceRunIdentityAtom: (id: EntryId) => AtomType.Atom<RunState["session"]["identity"]> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.identity)
)

export const surfaceLocalProjectionScriptAtom: (id: EntryId) => AtomType.Atom<LocalProjectionScript | null> = Atom
  .family(
    (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.localProjectionScript)
  )

export const surfaceLocalRunFrameAtom: (id: EntryId) => AtomType.Atom<LocalRunFrame | null> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.localRunFrame)
)

export const surfaceCanonicalFrameAtom: (id: EntryId) => AtomType.Atom<CanonicalFrame | null> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.canonicalFrame)
)

export const surfaceChoreographyStateAtom: (id: EntryId) => AtomType.Atom<ChoreographyState> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.choreography)
)

export const surfaceActiveLocalProjectionScriptAtom: (id: EntryId) => AtomType.Atom<LocalProjectionScript | null> = Atom
  .family(
    (id: EntryId) =>
      Atom.make((get: AtomType.Context) => {
        const run = get(surfaceRunStateAtom(id))
        return runIsActive(run) ? run.session.localProjectionScript : null
      })
  )

export const surfaceActiveLocalRunFrameAtom: (id: EntryId) => AtomType.Atom<LocalRunFrame | null> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      return runIsActive(run) ? run.session.localRunFrame : null
    })
)

export const surfaceActiveCanonicalFrameAtom: (id: EntryId) => AtomType.Atom<CanonicalFrame | null> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      return runIsActive(run) ? run.session.canonicalFrame : null
    })
)

export const surfaceStageTabAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceAtom(id)).stageTab)
)

export const surfaceRunDataAtom: (id: EntryId) => AtomType.Atom<RunData | null> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      return run._tag === "RunSuccess" ? run.data : null
    })
)
