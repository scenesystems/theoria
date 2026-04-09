import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import {
  defaultEvidencePlanePreferences,
  type EvidencePlaneFilter,
  type EvidencePlaneOrder,
  type EvidencePlanePreferences
} from "../../../contracts/evidence/plane.js"

export const surfaceEvidencePlaneAtom: (id: EntryId) => AtomType.Writable<EvidencePlanePreferences> = Atom.family(
  (_id: EntryId) => Atom.make(defaultEvidencePlanePreferences).pipe(Atom.keepAlive)
)

export const selectEvidencePlaneFilterAtom = Atom.fnSync<{
  readonly id: EntryId
  readonly filter: EvidencePlaneFilter
}>()(({ filter, id }, ctx) => {
  const current = ctx(surfaceEvidencePlaneAtom(id))
  ctx.set(surfaceEvidencePlaneAtom(id), {
    ...current,
    filter,
    sectionKey: null
  })
})

export const selectEvidencePlaneOrderAtom = Atom.fnSync<{
  readonly id: EntryId
  readonly order: EvidencePlaneOrder
}>()(({ id, order }, ctx) => {
  const current = ctx(surfaceEvidencePlaneAtom(id))
  ctx.set(surfaceEvidencePlaneAtom(id), {
    ...current,
    order
  })
})

export const selectEvidencePlaneSectionAtom = Atom.fnSync<{
  readonly id: EntryId
  readonly sectionKey: string | null
}>()(({ id, sectionKey }, ctx) => {
  const current = ctx(surfaceEvidencePlaneAtom(id))
  ctx.set(surfaceEvidencePlaneAtom(id), {
    ...current,
    sectionKey
  })
})
