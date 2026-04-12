import { Atom } from "@effect-atom/atom"

import type { DeepDiveProjectionPlane } from "../../../contracts/presentation/deep-dive-projection.js"
import type { DeepDiveProjectionWorkspaceLayout } from "../../../contracts/presentation/deep-dive-workspace-layout.js"
import { deepDiveProjectionWorkspaceLayout } from "../../../contracts/presentation/deep-dive-workspace-layout.js"
import type { DeepDivePanePercent } from "../../../contracts/presentation/layout.js"

import {
  deepDivePanePercentAtom,
  deepDiveSecondaryPanePercentAtom,
  deepDiveSourceExplorerVisibleAtom
} from "./deep-dive-pane.js"
import { deepDiveProjectionOrderAtom, type DeepDiveProjectionSurfaceState } from "./deep-dive-projection-order.js"

export type DeepDiveProjectionLayoutState = {
  readonly focusedSurface: DeepDiveProjectionPlane
  readonly maxProjectedCount: number
  readonly panePercent: DeepDivePanePercent
  readonly secondaryPanePercent: DeepDivePanePercent
  readonly sourceExplorerVisible: boolean
  readonly surfaces: ReadonlyArray<DeepDiveProjectionSurfaceState>
  readonly workspaceLayout: DeepDiveProjectionWorkspaceLayout
}

export const deepDiveProjectionLayoutAtom = Atom.make((get): DeepDiveProjectionLayoutState => {
  const orderState = get(deepDiveProjectionOrderAtom)
  const panePercent = get(deepDivePanePercentAtom)
  const secondaryPanePercent = get(deepDiveSecondaryPanePercentAtom)

  return {
    focusedSurface: orderState.focusedSurface,
    maxProjectedCount: orderState.maxProjectedCount,
    panePercent,
    secondaryPanePercent,
    sourceExplorerVisible: get(deepDiveSourceExplorerVisibleAtom),
    surfaces: orderState.surfaces,
    workspaceLayout: deepDiveProjectionWorkspaceLayout({
      focusedSurface: orderState.focusedSurface,
      panePercent,
      secondaryPanePercent,
      surfaces: orderState.surfaces
    })
  }
})
