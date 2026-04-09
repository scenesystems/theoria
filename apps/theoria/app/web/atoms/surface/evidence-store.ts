import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import { EvidenceStore } from "../../../contracts/evidence/store.js"
import { EvidenceStreamState } from "../../state/evidence/stream.js"

export const surfaceEvidenceStoreAtom: (id: EntryId) => AtomType.Writable<EvidenceStore> = Atom.family(
  (_id: EntryId) => Atom.make(EvidenceStore.empty()).pipe(Atom.keepAlive)
)

export const surfaceEvidenceSectionCountAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).sectionCount())
)

export const surfaceEvidenceCompleteAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).complete)
)

export const surfaceEvidenceSummaryAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).summary)
)

export const surfaceEvidenceMetaAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).meta)
)

export const surfaceEvidenceSectionsAtom: (id: EntryId) => AtomType.Atom<ReadonlyArray<EvidenceSection>> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).sections())
)

export const surfaceEvidenceStreamAtom: (id: EntryId) => AtomType.Atom<EvidenceStreamState> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => EvidenceStreamState.fromStore(get(surfaceEvidenceStoreAtom(id))))
)
