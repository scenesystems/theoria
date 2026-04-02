import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Option from "effect/Option"

import { cardById } from "../../../contracts/card.js"
import type { Id } from "../../../contracts/id.js"
import { controlRunAtom, selectProgramFileAtom, selectProgramSourceScopeAtom } from "../../atoms/actions.js"
import {
  deepDiveFocusedSurfaceAtom,
  deepDiveMaxProjectedSurfaceCountAtom,
  deepDivePanePercentAtom,
  deepDiveProjectedSurfaceCountAtom,
  deepDiveSecondaryPanePercentAtom,
  deepDiveSourceExplorerVisibleAtom,
  deepDiveSurfaceOrderAtom,
  focusDeepDiveSurfaceAtom,
  hideDeepDiveProjectedSurfaceAtom,
  projectDeepDiveSurfaceAtom,
  setDeepDivePanePercentAtom,
  setDeepDiveSecondaryPanePercentAtom,
  setDeepDiveWorkspaceWidthAtom,
  toggleDeepDiveSourceExplorerVisibleAtom
} from "../../atoms/deep-dive-layout.js"
import { deepDiveSurfaceFrameAtom } from "../../atoms/derived.js"
import type { RunControlActionKind } from "../../state/types.js"
import { Layer } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { PresentationSurface } from "../surfaces/PresentationSurface.js"

import { deepDiveProjectionSurfaceFor } from "./projection-surface.js"

export const DeepDivePage = ({ id }: { readonly id: Id }) => {
  const frameViewModel = useAtomValue(deepDiveSurfaceFrameAtom(id))
  const focusedSurface = useAtomValue(deepDiveFocusedSurfaceAtom)
  const maxProjectedSurfaceCount = useAtomValue(deepDiveMaxProjectedSurfaceCountAtom)
  const panePercent = useAtomValue(deepDivePanePercentAtom)
  const secondaryPanePercent = useAtomValue(deepDiveSecondaryPanePercentAtom)
  const projectedSurfaceCount = useAtomValue(deepDiveProjectedSurfaceCountAtom)
  const sourceExplorerVisible = useAtomValue(deepDiveSourceExplorerVisibleAtom)
  const surfaceOrder = useAtomValue(deepDiveSurfaceOrderAtom)
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
  const card = Option.getOrUndefined(cardById(id))
  const visibleProjectedSurfaceCount = Math.min(projectedSurfaceCount, maxProjectedSurfaceCount)

  const onRunControlAction = (action: RunControlActionKind): void => {
    dispatchRunControl({ action, id })
  }

  if (card === undefined || frameViewModel === null) {
    return (
      <Layer className="flex min-h-dvh items-center justify-center bg-stage-50 text-ink-900">
        <SemanticText as="p" className="text-ink-700" role="status" text={`Demo not found: ${id}`} variant="expanded" />
      </Layer>
    )
  }

  const surfaces = surfaceOrder.map((surface, index) => {
    const projected = index < visibleProjectedSurfaceCount
    const descriptor = deepDiveProjectionSurfaceFor(surface, {
      frameViewModel,
      id,
      onSelectFile: (fileIndex) => {
        dispatchSelectFile({ id, fileIndex })
      },
      onSelectSourceScope: (scope) => {
        dispatchSelectSourceScope({ id, scope })
      },
      projectionIndex: projected ? index : null,
      onToggleSourceExplorerVisible: () => {
        toggleSourceExplorerVisibility()
      },
      sourceExplorerVisible
    })

    return {
      ...descriptor,
      focused: focusedSurface === surface,
      position: projected ? index : null,
      projected
    }
  })

  return (
    <PresentationSurface
      backHref="/"
      card={card}
      chromeContent={frameViewModel.chrome}
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
        focusedSurface,
        maxProjectedCount: maxProjectedSurfaceCount,
        panePercent,
        secondaryPanePercent,
        surfaces
      }}
      runControls={frameViewModel.runControls}
    />
  )
}
