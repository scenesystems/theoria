import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import { type PresentedRun, presentRun } from "../../../contracts/presentation/presented-run.js"
import type { RunData } from "../../../contracts/study/run.js"

import { surfaceRunDataAtom } from "../surface/state.js"

export const presentedRunAtom: (id: EntryId) => AtomType.Atom<PresentedRun | null> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const runData: RunData | null = get(surfaceRunDataAtom(id))
      return runData !== null ? presentRun(runData) : null
    })
)
