import { Atom } from "@effect-atom/atom"
import { Match } from "effect"

import {
  type DeepDiveFocusedPane,
  DeepDiveFocusedPaneValue,
  type DeepDivePaneOrder,
  DeepDivePaneOrderValue,
  type DeepDiveStagePanePercent,
  DeepDiveStagePanePercentDefault,
  DeepDiveStagePanePercentMax,
  DeepDiveStagePanePercentMin
} from "../../contracts/layout.js"

export const deepDivePaneOrderAtom = Atom.make<DeepDivePaneOrder>(DeepDivePaneOrderValue.StageCode).pipe(Atom.keepAlive)

const clampedStagePanePercent = (value: number): DeepDiveStagePanePercent =>
  Math.max(DeepDiveStagePanePercentMin, Math.min(DeepDiveStagePanePercentMax, Math.round(value)))

export const deepDiveStagePanePercentAtom = Atom.make<DeepDiveStagePanePercent>(DeepDiveStagePanePercentDefault).pipe(
  Atom.keepAlive
)

export const deepDiveSourcePaneVisibleAtom = Atom.make(true).pipe(Atom.keepAlive)

// Compact layouts focus either the stage or source pane while the source
// visibility preference stays global across breakpoints.
export const deepDiveFocusedPaneAtom = Atom.make<DeepDiveFocusedPane>(DeepDiveFocusedPaneValue.Stage).pipe(
  Atom.keepAlive
)

export const deepDiveSourceExplorerVisibleAtom = Atom.make(true).pipe(Atom.keepAlive)

const toggledPaneOrder = (order: DeepDivePaneOrder): DeepDivePaneOrder =>
  Match.value(order).pipe(
    Match.when(DeepDivePaneOrderValue.StageCode, () => DeepDivePaneOrderValue.CodeStage),
    Match.when(DeepDivePaneOrderValue.CodeStage, () => DeepDivePaneOrderValue.StageCode),
    Match.exhaustive
  )

export const toggleDeepDivePaneOrderAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDivePaneOrderAtom, toggledPaneOrder(ctx(deepDivePaneOrderAtom)))
  }
)

export const setDeepDiveStagePanePercentAtom = Atom.fnSync<number>()(
  (nextPercent, ctx) => {
    ctx.set(deepDiveStagePanePercentAtom, clampedStagePanePercent(nextPercent))
  }
)

export const showDeepDiveSourcePaneAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveSourcePaneVisibleAtom, true)
  }
)

export const hideDeepDiveSourcePaneAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveSourcePaneVisibleAtom, false)
    ctx.set(deepDiveFocusedPaneAtom, DeepDiveFocusedPaneValue.Stage)
  }
)

export const focusDeepDiveSourcePaneAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveSourcePaneVisibleAtom, true)
    ctx.set(deepDiveFocusedPaneAtom, DeepDiveFocusedPaneValue.Source)
  }
)

export const focusDeepDiveStagePaneAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveFocusedPaneAtom, DeepDiveFocusedPaneValue.Stage)
  }
)

export const toggleDeepDiveSourceExplorerVisibleAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(deepDiveSourceExplorerVisibleAtom, !ctx(deepDiveSourceExplorerVisibleAtom))
  }
)
