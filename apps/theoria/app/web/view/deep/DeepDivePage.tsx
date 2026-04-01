import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Option from "effect/Option"

import { cardById } from "../../../contracts/card.js"
import type { Id } from "../../../contracts/id.js"
import {
  controlRunAtom,
  selectProgramFileAtom,
  selectProgramSourceScopeAtom,
  selectStageTabAtom
} from "../../atoms/actions.js"
import {
  deepDiveFocusedPaneAtom,
  deepDivePaneOrderAtom,
  deepDiveSourceExplorerVisibleAtom,
  deepDiveSourcePaneVisibleAtom,
  deepDiveStagePanePercentAtom,
  focusDeepDiveSourcePaneAtom,
  focusDeepDiveStagePaneAtom,
  hideDeepDiveSourcePaneAtom,
  setDeepDiveStagePanePercentAtom,
  showDeepDiveSourcePaneAtom,
  toggleDeepDivePaneOrderAtom,
  toggleDeepDiveSourceExplorerVisibleAtom
} from "../../atoms/deep-dive-layout.js"
import {
  deepDiveEvidenceAtom,
  deepDiveStageFrameAtom,
  deepDiveStatusAtom,
  deepDiveSurfaceFrameAtom
} from "../../atoms/derived.js"
import { surfaceRunRuntimeTelemetryViewModelAtom } from "../../atoms/surface.js"
import type { RunControlActionKind } from "../../state/types.js"
import { surfaceThemeForCard } from "../primitives/designSystem.js"
import { EvidenceRows } from "../primitives/EvidenceRows.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SurfacePanel } from "../primitives/SurfacePanels.js"
import { SurfaceStatus } from "../primitives/SurfaceStatus.js"
import type { RunControlsViewModel } from "../runControlsModel.js"
import { PresentationSurface } from "../surfaces/PresentationSurface.js"

import { EvidenceStage } from "./DemoStage.js"
import { interactiveWidgetFor } from "./interactiveWidgets.js"

const stagePaneClassName = (active: boolean): string => active ? "min-h-0 flex-1" : "hidden min-h-0 flex-1"

const RunRuntimeTelemetryPanel = ({ id }: { readonly id: Id }) => {
  const telemetry = useAtomValue(surfaceRunRuntimeTelemetryViewModelAtom(id))

  return !import.meta.env.DEV || telemetry === null
    ? null
    : (
      <SurfacePanel className="border-stage-200/75 bg-stage-0/80" title="Dev Runtime Timing" variant="expanded">
        <EvidenceRows density="expanded" rows={telemetry.rows} variant="expanded" />
      </SurfacePanel>
    )
}

const DeepDiveStatus = ({ id }: { readonly id: Id }) => {
  const status = useAtomValue(deepDiveStatusAtom(id))
  const theme = surfaceThemeForCard(id)
  const telemetryPanel = <RunRuntimeTelemetryPanel id={id} />

  return status === null
    ? telemetryPanel
    : (
      <Stack className="gap-3">
        <SurfaceStatus status={status} theme={theme} tone="strip" variant="expanded" />
        {telemetryPanel}
      </Stack>
    )
}

const ConnectedEvidenceStage = ({
  controls,
  id
}: {
  readonly controls: RunControlsViewModel
  readonly id: Id
}) => {
  const evidence = useAtomValue(deepDiveEvidenceAtom(id))

  return evidence === null
    ? null
    : <EvidenceStage controls={controls} viewModel={evidence} />
}

export const DeepDivePage = ({ id }: { readonly id: Id }) => {
  const frameViewModel = useAtomValue(deepDiveSurfaceFrameAtom(id))
  const focusedPane = useAtomValue(deepDiveFocusedPaneAtom)
  const paneOrder = useAtomValue(deepDivePaneOrderAtom)
  const sourceExplorerVisible = useAtomValue(deepDiveSourceExplorerVisibleAtom)
  const sourcePaneVisible = useAtomValue(deepDiveSourcePaneVisibleAtom)
  const stagePanePercent = useAtomValue(deepDiveStagePanePercentAtom)
  const stageFrame = useAtomValue(deepDiveStageFrameAtom(id))
  const dispatchRunControl = useAtomSet(controlRunAtom)
  const dispatchSelectStageTab = useAtomSet(selectStageTabAtom)
  const dispatchSelectFile = useAtomSet(selectProgramFileAtom)
  const dispatchSelectSourceScope = useAtomSet(selectProgramSourceScopeAtom)
  const dispatchStagePanePercent = useAtomSet(setDeepDiveStagePanePercentAtom)
  const focusSourcePane = useAtomSet(focusDeepDiveSourcePaneAtom)
  const focusStagePane = useAtomSet(focusDeepDiveStagePaneAtom)
  const hideSourcePane = useAtomSet(hideDeepDiveSourcePaneAtom)
  const showSourcePane = useAtomSet(showDeepDiveSourcePaneAtom)
  const togglePaneOrder = useAtomSet(toggleDeepDivePaneOrderAtom)
  const toggleSourceExplorerVisibility = useAtomSet(toggleDeepDiveSourceExplorerVisibleAtom)
  const card = Option.getOrUndefined(cardById(id))

  const onRunControlAction = (action: RunControlActionKind): void => {
    dispatchRunControl({ action, id })
  }

  if (card === undefined || frameViewModel === null || stageFrame === null) {
    return (
      <Layer className="flex min-h-dvh items-center justify-center bg-stage-50 text-ink-900">
        <SemanticText as="p" className="text-ink-700" role="status" text={`Demo not found: ${id}`} variant="expanded" />
      </Layer>
    )
  }

  const interactiveContent = interactiveWidgetFor(id)
  const evidenceContent = <ConnectedEvidenceStage controls={frameViewModel.runControls} id={id} />
  const stageContent = interactiveContent === undefined
    ? evidenceContent
    : (
      <Stack className="min-h-0 h-full flex-1 gap-0">
        <Layer className={stagePaneClassName(stageFrame.activeTab === "interactive")}>{interactiveContent}</Layer>
        <Layer className={stagePaneClassName(stageFrame.activeTab === "evidence")}>{evidenceContent}</Layer>
      </Stack>
    )

  return (
    <PresentationSurface
      backHref="/"
      card={card}
      deepDiveHref={undefined}
      frameViewModel={frameViewModel}
      interactiveContent={interactiveContent}
      onRunControlAction={onRunControlAction}
      onSelectStageTab={(tab) => {
        dispatchSelectStageTab({ id, tab })
      }}
      onSelectFile={(fileIndex) => {
        dispatchSelectFile({ id, fileIndex })
      }}
      onSelectSourceScope={(scope) => {
        dispatchSelectSourceScope({ id, scope })
      }}
      onToggleSourceExplorerVisibility={() => {
        toggleSourceExplorerVisibility()
      }}
      onTogglePaneOrder={() => {
        togglePaneOrder()
      }}
      focusedPane={focusedPane}
      onFocusSourcePane={() => {
        focusSourcePane()
      }}
      onFocusStagePane={() => {
        focusStagePane()
      }}
      onHideSourcePane={() => {
        hideSourcePane()
      }}
      onShowSourcePane={() => {
        showSourcePane()
      }}
      paneOrder={paneOrder}
      sourceExplorerVisible={sourceExplorerVisible}
      sourcePaneVisible={sourcePaneVisible}
      stagePanePercent={stagePanePercent}
      onStagePanePercentChange={(nextPercent) => {
        dispatchStagePanePercent(nextPercent)
      }}
      stageContent={stageContent}
      stageFrame={stageFrame}
      statusContent={<DeepDiveStatus id={id} />}
      variant="expanded"
    />
  )
}
