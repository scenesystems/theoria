import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import type { EntryId } from "../../../contracts/entry/id.js"
import { metadataForEntryId } from "../../../contracts/presentation/metadata.js"
import { deepDiveSurfaceFrameAtom } from "../../atoms/derived.js"
import {
  setDeepDivePanePercentAtom,
  setDeepDiveSecondaryPanePercentAtom,
  toggleDeepDiveSourceExplorerVisibleAtom
} from "../../atoms/layout/deep-dive-pane.js"
import { deepDiveProjectionLayoutAtom } from "../../atoms/layout/deep-dive-projection-layout.js"
import {
  focusDeepDiveSurfaceAtom,
  hideDeepDiveProjectedSurfaceAtom,
  projectDeepDiveSurfaceAtom
} from "../../atoms/layout/deep-dive-surface-projection.js"
import { setDeepDiveWorkspaceWidthAtom } from "../../atoms/layout/deep-dive-viewport.js"
import { controlRunAtom } from "../../atoms/run/control-actions.js"
import { selectProgramFileAtom, selectProgramSourceScopeAtom } from "../../atoms/surface/program-source-actions.js"
import type { RunControlActionKind } from "../../state/run/types.js"
import { DocumentHead } from "../primitives/DocumentHead.js"
import { PresentationSurface } from "../surfaces/PresentationSurface.js"

import { DeepDiveProjectionSurfaceContext } from "./projection-surface-context.js"
import { deepDiveProjectionSurfaceFor } from "./projection-surface.js"

export const DeepDivePage = ({ entryId }: { readonly entryId: EntryId }) => {
  const frameViewModel = useAtomValue(deepDiveSurfaceFrameAtom(entryId))
  const layout = useAtomValue(deepDiveProjectionLayoutAtom)
  const dispatchFocusSurface = useAtomSet(focusDeepDiveSurfaceAtom)
  const dispatchHideSurface = useAtomSet(hideDeepDiveProjectedSurfaceAtom)
  const dispatchPanePercent = useAtomSet(setDeepDivePanePercentAtom)
  const dispatchSecondaryPanePercent = useAtomSet(setDeepDiveSecondaryPanePercentAtom)
  const dispatchProjectSurface = useAtomSet(projectDeepDiveSurfaceAtom)
  const dispatchRunControl = useAtomSet(controlRunAtom)
  const dispatchSelectFile = useAtomSet(selectProgramFileAtom)
  const dispatchSelectSourceScope = useAtomSet(selectProgramSourceScopeAtom)
  const dispatchWorkspaceWidth = useAtomSet(setDeepDiveWorkspaceWidthAtom)
  const toggleSourceExplorerVisibility = useAtomSet(toggleDeepDiveSourceExplorerVisibleAtom)
  const pageMetadata = metadataForEntryId(entryId)

  const onRunControlAction = (action: RunControlActionKind): void => {
    dispatchRunControl({ action, id: entryId })
  }

  const surfaces = layout.surfaces.map((surface) => {
    const descriptor = deepDiveProjectionSurfaceFor(
      surface.id,
      DeepDiveProjectionSurfaceContext.make({
        frameViewModel,
        id: entryId,
        onSelectFile: (fileIndex) => {
          dispatchSelectFile({ id: entryId, fileIndex })
        },
        onSelectSourceScope: (scope) => {
          dispatchSelectSourceScope({ id: entryId, scope })
        },
        projectionIndex: surface.position,
        onToggleSourceExplorerVisible: () => {
          toggleSourceExplorerVisibility()
        },
        sourceExplorerVisible: layout.sourceExplorerVisible
      })
    )

    return {
      ...descriptor,
      ...surface
    }
  })

  return (
    <>
      <DocumentHead metadata={pageMetadata} />

      <PresentationSurface
        backHref="/"
        chromeContent={frameViewModel.chrome}
        entryId={entryId}
        onFocusSurface={(surface) => {
          dispatchFocusSurface(surface)
        }}
        onHideSurface={(surface) => {
          dispatchHideSurface(surface)
        }}
        onPanePercentChange={(nextPercent) => {
          dispatchPanePercent(nextPercent)
        }}
        onRunControlAction={onRunControlAction}
        onSecondaryPanePercentChange={(nextPercent) => {
          dispatchSecondaryPanePercent(nextPercent)
        }}
        onProjectSurface={(surface, index) => {
          dispatchProjectSurface(index === undefined ? { surface } : { index, surface })
        }}
        onWorkspaceWidthChange={dispatchWorkspaceWidth}
        projection={{
          focusedSurface: layout.focusedSurface,
          maxProjectedCount: layout.maxProjectedCount,
          panePercent: layout.panePercent,
          secondaryPanePercent: layout.secondaryPanePercent,
          surfaces,
          workspaceLayout: layout.workspaceLayout
        }}
        runControls={frameViewModel.runControls}
      />
    </>
  )
}
