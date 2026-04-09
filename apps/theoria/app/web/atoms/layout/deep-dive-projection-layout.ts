import { Atom } from "@effect-atom/atom"

import type { DeepDivePanePercent } from "../../../contracts/presentation/layout.js"
import type { DeepDiveProjectionWorkspaceLayout } from "../../state/surface/deep-dive-workspace-layout.js"
import { deepDiveProjectionWorkspaceLayout } from "../../state/surface/deep-dive-workspace-layout.js"
import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"

import {
  deepDivePanePercentAtom,
  deepDiveSecondaryPanePercentAtom,
  deepDiveSourceExplorerVisibleAtom
} from "./deep-dive-pane.js"
import { deepDiveProjectionLaneAtom, type DeepDiveProjectionSurfaceState } from "./deep-dive-projection-lane.js"

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
  const laneState = get(deepDiveProjectionLaneAtom)
  const panePercent = get(deepDivePanePercentAtom)
  const secondaryPanePercent = get(deepDiveSecondaryPanePercentAtom)

  return {
    focusedSurface: laneState.focusedSurface,
    maxProjectedCount: laneState.maxProjectedCount,
    panePercent,
    secondaryPanePercent,
    sourceExplorerVisible: get(deepDiveSourceExplorerVisibleAtom),
    surfaces: laneState.surfaces,
    workspaceLayout: deepDiveProjectionWorkspaceLayout({
      focusedSurface: laneState.focusedSurface,
      panePercent,
      secondaryPanePercent,
      surfaces: laneState.surfaces
    })
  }
})
