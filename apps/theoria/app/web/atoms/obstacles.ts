import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

export const obstaclesEnabledAtom: AtomType.Writable<boolean> = Atom.make(false)
