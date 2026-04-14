import { Atom } from "@effect-atom/atom"

export const initialPackageDocsVisibleSectionCount = 8
export const packageDocsVisibleSectionCountStep = 8

export const packageDocsActiveGroupAtom = Atom.make("").pipe(Atom.keepAlive)

export const packageDocsVisibleSectionCountAtom = Atom.family((_: string) =>
  Atom.make(initialPackageDocsVisibleSectionCount).pipe(Atom.keepAlive)
)
