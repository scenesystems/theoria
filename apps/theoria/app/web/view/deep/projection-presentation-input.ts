import type { EntryId } from "../../../contracts/entry/id.js"
import {
  DeepDiveProjectionModel,
  type DeepDiveProjectionPresentationInput
} from "../../../contracts/presentation/deep-dive-projection-model.js"
import type { ProgramSourceScope } from "../../../contracts/presentation/program.js"
import type { DeepDiveSurfaceFrameViewModel } from "../../../contracts/presentation/surface-presentation.js"
import type { DeepDiveProjectionLayoutState } from "../../atoms/layout/deep-dive-projection-layout.js"

import { DeepDiveProjectionSurfaceContext } from "./projection-surface-context.js"
import { deepDiveProjectionPaneFor } from "./projection-surface-panes.js"

type DeepDiveProjectionCallbacks = {
  readonly onSelectFile: (fileIndex: number) => void
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly onToggleSourceExplorerVisible: () => void
}

type DeepDiveProjectionInput = {
  readonly entryId: EntryId
  readonly frameViewModel: DeepDiveSurfaceFrameViewModel
  readonly layout: DeepDiveProjectionLayoutState
} & DeepDiveProjectionCallbacks

export const deepDiveProjectionPresentationInput = ({
  entryId,
  frameViewModel,
  layout,
  onSelectFile,
  onSelectSourceScope,
  onToggleSourceExplorerVisible
}: DeepDiveProjectionInput): DeepDiveProjectionPresentationInput => ({
  focusedSurface: layout.focusedSurface,
  maxProjectedCount: layout.maxProjectedCount,
  panePercent: layout.panePercent,
  secondaryPanePercent: layout.secondaryPanePercent,
  surfaces: layout.surfaces.map((surface) => ({
    pane: deepDiveProjectionPaneFor({
      context: DeepDiveProjectionSurfaceContext.make({
        frameViewModel,
        id: entryId,
        onSelectFile,
        onSelectSourceScope,
        onToggleSourceExplorerVisible,
        projectionIndex: surface.position,
        sourceExplorerVisible: layout.sourceExplorerVisible
      }),
      surface: surface.id
    }),
    surface
  })),
  workspaceLayout: layout.workspaceLayout
})

export const deepDiveProjectionPresentation = (input: DeepDiveProjectionInput): DeepDiveProjectionModel =>
  DeepDiveProjectionModel.project(deepDiveProjectionPresentationInput(input))
