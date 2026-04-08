import { Atom } from "@effect-atom/atom"

import {
  type DeepDivePanePercent,
  DeepDivePanePercentDefault,
  DeepDivePanePercentMax,
  DeepDivePanePercentMin
} from "../../../contracts/presentation/layout.js"

const clampedPanePercent = (value: number): DeepDivePanePercent =>
  Math.max(DeepDivePanePercentMin, Math.min(DeepDivePanePercentMax, Math.round(value)))

export const deepDivePanePercentAtom = Atom.make<DeepDivePanePercent>(DeepDivePanePercentDefault).pipe(
  Atom.keepAlive
)

export const deepDiveSecondaryPanePercentAtom = Atom.make<DeepDivePanePercent>(50).pipe(Atom.keepAlive)

export const deepDiveSourceExplorerVisibleAtom = Atom.make(true).pipe(Atom.keepAlive)

export const setDeepDivePanePercentAtom = Atom.fnSync<number>()(
  (nextPercent, ctx) => {
    ctx.set(deepDivePanePercentAtom, clampedPanePercent(nextPercent))
  }
)

export const setDeepDiveSecondaryPanePercentAtom = Atom.fnSync<number>()(
  (nextPercent, ctx) => {
    ctx.set(deepDiveSecondaryPanePercentAtom, clampedPanePercent(nextPercent))
  }
)

export const toggleDeepDiveSourceExplorerVisibleAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveSourceExplorerVisibleAtom, !ctx(deepDiveSourceExplorerVisibleAtom))
  }
)
