import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { SurfaceId } from "../../contracts/id.js"
import type { EvidencePlaneFilter, EvidencePlaneOrder } from "../view/data/evidence-layout.js"

export type EvidencePlanePreferences = {
  readonly filter: EvidencePlaneFilter
  readonly order: EvidencePlaneOrder
  readonly sectionKey: string | null
}

const defaultEvidencePlanePreferences: EvidencePlanePreferences = {
  filter: "all",
  order: "narrative",
  sectionKey: null
}

export const surfaceEvidencePlaneAtom: (id: SurfaceId) => AtomType.Writable<EvidencePlanePreferences> = Atom.family(
  (_id: SurfaceId) => Atom.make(defaultEvidencePlanePreferences).pipe(Atom.keepAlive)
)

export const selectEvidencePlaneFilterAtom = Atom.fnSync<{
  readonly id: SurfaceId
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
  readonly id: SurfaceId
  readonly order: EvidencePlaneOrder
}>()(({ id, order }, ctx) => {
  const current = ctx(surfaceEvidencePlaneAtom(id))
  ctx.set(surfaceEvidencePlaneAtom(id), {
    ...current,
    order
  })
})

export const selectEvidencePlaneSectionAtom = Atom.fnSync<{
  readonly id: SurfaceId
  readonly sectionKey: string | null
}>()(({ id, sectionKey }, ctx) => {
  const current = ctx(surfaceEvidencePlaneAtom(id))
  ctx.set(surfaceEvidencePlaneAtom(id), {
    ...current,
    sectionKey
  })
})
