import { Atom } from "@effect-atom/atom"

export const packageDocsPageScrollBodyId = "package-docs-page-scroll-body"

export const packageDocsPageScrolledAtom = Atom.family((_: string) => Atom.make(false).pipe(Atom.keepAlive))

export const packageDocsLibraryMenuOpenAtom = Atom.family((_: string) => Atom.make(false).pipe(Atom.keepAlive))
