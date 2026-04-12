import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Schema } from "effect"

import { EntryId } from "../../../contracts/entry/id.js"
import type { EntryId as EntryIdType } from "../../../contracts/entry/id.js"
import { EntryPresentation } from "../../../contracts/entry/routing.js"
import type { SurfaceVariant } from "../../../contracts/presentation/program.js"
import type { SurfaceViewModel } from "../../../contracts/presentation/surface-presentation.js"
import { surfaceViewModel } from "../../view/surfaceModel.js"

import { presentedRunAtom } from "../run/presented-run.js"
import { surfaceEvidenceStreamAtom } from "./evidence-store.js"
import { surfaceAtom } from "./state.js"

type ViewModelKey = `${EntryIdType}:${SurfaceVariant}`

export const viewModelKey = (id: EntryIdType, variant: SurfaceVariant): ViewModelKey => `${id}:${variant}`

const isEntryId = Schema.is(EntryId)

export const surfaceViewModelAtom: (key: ViewModelKey) => AtomType.Atom<SurfaceViewModel | null> = Atom.family(
  (key: ViewModelKey) => {
    const separatorIndex = key.lastIndexOf(":")
    const rawId = key.slice(0, separatorIndex)
    const variant: SurfaceVariant = key.slice(separatorIndex + 1) === "compact" ? "compact" : "expanded"

    if (!isEntryId(rawId)) {
      return Atom.make(() => null)
    }

    const id = rawId
    return Atom.make((get: AtomType.Context) => {
      const state = get(surfaceAtom(id))
      const presented = get(presentedRunAtom(id))
      const stream = get(surfaceEvidenceStreamAtom(id))

      return surfaceViewModel({
        surface: EntryPresentation.fromEntryId(id),
        presented,
        state,
        stream,
        variant
      })
    })
  }
)
