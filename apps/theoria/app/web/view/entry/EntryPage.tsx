import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import type { EntryPresentation } from "../../../contracts/entry/routing.js"
import type { PageMetadata } from "../../../contracts/presentation/metadata.js"
import { controlRunAtom } from "../../atoms/run/control-actions.js"
import { surfaceRunLifecycleDiagnosticsViewModelAtom } from "../../atoms/run/diagnostics.js"
import { selectProgramFileAtom, selectProgramSourceScopeAtom } from "../../atoms/surface/program-source-actions.js"
import {
  focusSurfaceAtom,
  hideSurfaceAtom,
  projectSurfaceAtom,
  reorderSurfaceAtom,
  surfaceProjectionModelAtom
} from "../../atoms/surface/projection.js"
import { surfaceViewModelAtom, viewModelKey } from "../../atoms/surface/view-model.js"
import type { RunControlActionKind } from "../../state/run/types.js"
import { DocumentHead } from "../primitives/DocumentHead.js"
import { PresentationSurface } from "../surfaces/PresentationSurface.js"

export const EntryPage = ({
  entry,
  metadata
}: {
  readonly entry: EntryPresentation
  readonly metadata: PageMetadata
}) => {
  const entryId = entry.entryId
  const viewModel = useAtomValue(surfaceViewModelAtom(viewModelKey(entryId, "expanded")))
  const diagnostics = useAtomValue(surfaceRunLifecycleDiagnosticsViewModelAtom(entryId))
  const projection = useAtomValue(surfaceProjectionModelAtom(entryId))
  const dispatchRunControl = useAtomSet(controlRunAtom)
  const dispatchSelectFile = useAtomSet(selectProgramFileAtom)
  const dispatchSelectSourceScope = useAtomSet(selectProgramSourceScopeAtom)
  const dispatchProjectSurface = useAtomSet(projectSurfaceAtom)
  const dispatchHideSurface = useAtomSet(hideSurfaceAtom)
  const dispatchFocusSurface = useAtomSet(focusSurfaceAtom)
  const dispatchReorderSurface = useAtomSet(reorderSurfaceAtom)

  const onRunControlAction = (action: RunControlActionKind): void => {
    dispatchRunControl({ action, id: entryId })
  }

  return (
    <>
      <DocumentHead metadata={metadata} />

      {viewModel === null
        ? null
        : (
          <PresentationSurface
            backHref="/"
            diagnostics={diagnostics}
            entryId={entryId}
            model={viewModel}
            onFocusSurface={(plane) => {
              dispatchFocusSurface({ id: entryId, plane })
            }}
            onHideSurface={(plane) => {
              dispatchHideSurface({ id: entryId, plane })
            }}
            onProjectSurface={(plane) => {
              dispatchProjectSurface({ id: entryId, plane })
            }}
            onReorderSurface={(plane, index) => {
              dispatchReorderSurface({ id: entryId, plane, index })
            }}
            onRunControlAction={onRunControlAction}
            onSelectFile={(fileIndex) => {
              dispatchSelectFile({ id: entryId, fileIndex })
            }}
            onSelectSourceScope={(scope) => {
              dispatchSelectSourceScope({ id: entryId, scope })
            }}
            projection={projection}
          />
        )}
    </>
  )
}
