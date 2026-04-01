import { Separator } from "@base-ui-components/react/separator"
import { Toolbar } from "@base-ui-components/react/toolbar"
import { FolderIcon } from "@heroicons/react/20/solid"
import { PauseIcon, PlayIcon, StopIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"
import * as Option from "effect/Option"
import type { ReactNode } from "react"

import type { Card } from "../../../contracts/card.js"
import {
  type DeepDiveFocusedPane,
  DeepDiveFocusedPaneValue,
  type DeepDivePaneOrder,
  DeepDivePaneOrderValue,
  type DeepDiveStagePanePercent,
  DeepDiveStagePanePercentMax,
  DeepDiveStagePanePercentMin
} from "../../../contracts/layout.js"
import type { ProgramSourceScope, SurfaceVariant } from "../../../contracts/presentation.js"
import type { RunControlActionKind, StageTab } from "../../state/types.js"

import { Pane } from "../containers/Pane.js"
import { SplitPane } from "../containers/SplitPane.js"
import { CompactNav } from "../deep/CompactNav.js"
import { DemoStage } from "../deep/DemoStage.js"
import type { DemoStageFrameViewModel } from "../deep/stageModel.js"
import { ActionButton } from "../primitives/ActionControl.js"
import { surfaceThemeForCard } from "../primitives/designSystem.js"
import { EvidenceRows } from "../primitives/EvidenceRows.js"
import { HintTooltip } from "../primitives/HintTooltip.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { ProgramCodePanel } from "../primitives/ProgramCodePanel.js"
import { SurfaceHeader } from "../primitives/SurfaceHeader.js"
import { SurfacePanel, SurfaceShell } from "../primitives/SurfacePanels.js"
import { SurfaceStatus } from "../primitives/SurfaceStatus.js"
import { TabBar, TabButton } from "../primitives/TabBar.js"
import { surfaceChromeModel } from "../surfaceChromeModel.js"
import type { DeepDiveSurfaceFrameViewModel, SurfaceViewModel } from "../surfaceModel.js"

const controlIcon = (action: RunControlActionKind) =>
  Match.value(action).pipe(
    Match.when("pause", () => <PauseIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />),
    Match.when("stop", () => <StopIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />),
    Match.orElse(() => <PlayIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />)
  )

export const PresentationSurface = ({
  backHref,
  card,
  deepDiveHref,
  frameViewModel,
  interactiveContent,
  onRunControlAction,
  onSelectStageTab,
  onSelectFile,
  onSelectSourceScope,
  focusedPane,
  onFocusSourcePane,
  onFocusStagePane,
  onHideSourcePane,
  onShowSourcePane,
  onToggleSourceExplorerVisibility,
  onStagePanePercentChange,
  onTogglePaneOrder,
  paneOrder = DeepDivePaneOrderValue.StageCode,
  sourceExplorerVisible,
  sourcePaneVisible,
  stagePanePercent,
  stageContent,
  stageFrame,
  statusContent,
  variant,
  viewModel
}: {
  readonly backHref: string | undefined
  readonly card: Card
  readonly deepDiveHref: string | undefined
  readonly frameViewModel?: DeepDiveSurfaceFrameViewModel
  readonly interactiveContent?: ReactNode
  readonly onRunControlAction: (action: RunControlActionKind) => void
  readonly onSelectStageTab?: (tab: StageTab) => void
  readonly onSelectFile: (index: number) => void
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly focusedPane: DeepDiveFocusedPane
  readonly onFocusSourcePane?: (() => void) | undefined
  readonly onFocusStagePane?: (() => void) | undefined
  readonly onHideSourcePane?: (() => void) | undefined
  readonly onShowSourcePane?: (() => void) | undefined
  readonly onToggleSourceExplorerVisibility?: (() => void) | undefined
  readonly onStagePanePercentChange: (nextPercent: number) => void
  readonly onTogglePaneOrder?: (() => void) | undefined
  readonly paneOrder?: DeepDivePaneOrder
  readonly sourceExplorerVisible: boolean
  readonly sourcePaneVisible: boolean
  readonly stagePanePercent: DeepDiveStagePanePercent
  readonly stageContent?: ReactNode
  readonly stageFrame?: DemoStageFrameViewModel
  readonly statusContent?: ReactNode
  readonly variant: SurfaceVariant
  readonly viewModel?: SurfaceViewModel
}) => {
  const theme = surfaceThemeForCard(card.id)
  const expandedFrame = frameViewModel ?? Option.fromNullable(viewModel).pipe(
    Option.map((resolvedViewModel) => ({
      runControls: resolvedViewModel.runControls,
      chrome: resolvedViewModel.chrome,
      code: resolvedViewModel.code,
      stageFrame: {
        activeTab: resolvedViewModel.stage.activeTab,
        showTabs: resolvedViewModel.stage.showTabs,
        interactiveLabel: resolvedViewModel.stage.interactiveLabel,
        hintText: resolvedViewModel.stage.hintText
      }
    })),
    Option.getOrUndefined
  )

  if (variant === "compact") {
    if (viewModel === undefined) {
      return null
    }

    const chrome = surfaceChromeModel({
      backHref: Option.fromNullable(backHref),
      content: viewModel.chrome,
      deepDiveHref: Option.fromNullable(deepDiveHref)
    })

    return (
      <SurfaceShell className={theme.shell} variant={variant}>
        <Separator className={`h-1 rounded-full ${theme.accent}`} />
        <SurfaceHeader
          chrome={chrome}
          controls={viewModel.runControls}
          onRunControlAction={onRunControlAction}
          theme={theme}
          variant={variant}
        />
        <SurfaceStatus status={viewModel.status} theme={theme} tone={viewModel.statusTone} variant={variant} />
        <SurfacePanel className={theme.panel} title="Snapshot" variant={variant}>
          <EvidenceRows density={viewModel.evidenceDensity} rows={viewModel.evidenceRows} variant={variant} />
        </SurfacePanel>
      </SurfaceShell>
    )
  }

  if (expandedFrame === undefined) {
    return null
  }

  const chrome = surfaceChromeModel({
    backHref: Option.fromNullable(backHref),
    content: expandedFrame.chrome,
    deepDiveHref: Option.fromNullable(deepDiveHref)
  })

  const resolvedStage = {
    content: stageContent ?? (viewModel === undefined
      ? null
      : (
        <DemoStage
          controls={viewModel.runControls}
          interactiveContent={interactiveContent}
          onRunControlAction={onRunControlAction}
          viewModel={viewModel.stage}
        />
      )),
    frame: stageFrame ?? expandedFrame.stageFrame,
    status: statusContent ?? (viewModel === undefined
      ? null
      : <SurfaceStatus status={viewModel.status} theme={theme} tone={viewModel.statusTone} variant={variant} />)
  }
  const showStageChrome = resolvedStage.frame.showTabs && interactiveContent !== undefined
  const showStageStatus = !showStageChrome && resolvedStage.status !== null

  const codePane = (
    <Pane className="min-h-0 h-full flex-1 bg-stage-100" key="code-pane" scroll="none">
      <ProgramCodePanel
        codeClassName={theme.codePanel.codeContainer}
        codePanelTheme={theme.codePanel}
        entry={expandedFrame.code.entry}
        fileName={expandedFrame.code.fileName}
        filesVisible={sourceExplorerVisible}
        fileTabs={expandedFrame.code.fileTabs}
        onSelectFile={onSelectFile}
        onSelectSourceScope={onSelectSourceScope}
        onToggleFilesVisible={() => {
          onToggleSourceExplorerVisibility?.()
        }}
        focusedPane={focusedPane}
        onFocusStagePane={onFocusStagePane}
        onHideSourcePane={onHideSourcePane}
        onSwapSide={onTogglePaneOrder}
        originLabel={expandedFrame.code.originLabel}
        selectedFileIndex={expandedFrame.code.selectedFileIndex}
        selectedSourceScope={expandedFrame.code.selectedSourceScope}
        source={expandedFrame.code.source}
        sourceTabs={expandedFrame.code.sourceTabs}
        swapSideLabel={paneOrder === DeepDivePaneOrderValue.StageCode ? "Move Source Left" : "Move Source Right"}
        variant={variant}
      />
    </Pane>
  )
  const stagePane = (
    <Pane className="min-h-0 h-full flex-1 bg-stage-0" key="stage-pane" scroll="vertical">
      <Stack className="h-full">
        {showStageChrome
          ? (
            <Layer className="shrink-0 border-b border-stage-200/65 px-4 py-4 sm:px-5">
              <Stack className="gap-4">
                <Cluster className="items-center justify-between gap-3">
                  <Toolbar.Root className="min-w-0" loopFocus>
                    <Toolbar.Group className="flex flex-wrap items-center gap-2">
                      <ActionButton
                        className={theme.primaryAction}
                        disabled={expandedFrame.runControls.primary.disabled}
                        icon={controlIcon(expandedFrame.runControls.primary.action)}
                        label={expandedFrame.runControls.primary.label}
                        onClick={() => {
                          onRunControlAction(expandedFrame.runControls.primary.action)
                        }}
                        variant={variant}
                      />
                      {Option.match(expandedFrame.runControls.secondary, {
                        onNone: () => null,
                        onSome: (secondary) => (
                          <ActionButton
                            className={theme.secondaryAction}
                            disabled={secondary.disabled}
                            label={secondary.label}
                            onClick={() => {
                              onRunControlAction(secondary.action)
                            }}
                            variant={variant}
                          />
                        )
                      })}
                    </Toolbar.Group>
                  </Toolbar.Root>
                  <Cluster className="items-center gap-1">
                    <HintTooltip text={resolvedStage.frame.hintText} />
                    <TabBar>
                      <TabButton
                        active={resolvedStage.frame.activeTab === "interactive"}
                        label={resolvedStage.frame.interactiveLabel ?? "Interactive"}
                        onClick={() => {
                          onSelectStageTab?.("interactive")
                        }}
                      />
                      <TabButton
                        active={resolvedStage.frame.activeTab === "evidence"}
                        label="Results"
                        onClick={() => {
                          onSelectStageTab?.("evidence")
                        }}
                      />
                      {onFocusSourcePane !== undefined
                        ? (
                          <TabButton
                            active={sourcePaneVisible && focusedPane === DeepDiveFocusedPaneValue.Source}
                            className="lg:hidden"
                            icon={<FolderIcon aria-hidden className="h-4 w-4 shrink-0" />}
                            label="Source"
                            onClick={onFocusSourcePane}
                          />
                        )
                        : null}
                      {onShowSourcePane !== undefined && !sourcePaneVisible
                        ? (
                          <TabButton
                            active={false}
                            className="max-lg:hidden"
                            icon={<FolderIcon aria-hidden className="h-4 w-4 shrink-0" />}
                            label="Source"
                            onClick={onShowSourcePane}
                          />
                        )
                        : null}
                    </TabBar>
                  </Cluster>
                </Cluster>
              </Stack>
            </Layer>
          )
          : null}
        <Layer className="min-h-0 flex-1 px-4 py-4 sm:px-5 sm:py-5">
          <Stack className="min-h-0 flex-1 gap-4">
            {showStageStatus ? resolvedStage.status : null}
            <Layer className="min-h-0 flex-1">{resolvedStage.content}</Layer>
          </Stack>
        </Layer>
      </Stack>
    </Pane>
  )
  const firstPanePercent = paneOrder === DeepDivePaneOrderValue.StageCode
    ? stagePanePercent
    : 100 - stagePanePercent
  const firstPanePercentMin = paneOrder === DeepDivePaneOrderValue.StageCode
    ? DeepDiveStagePanePercentMin
    : 100 - DeepDiveStagePanePercentMax
  const firstPanePercentMax = paneOrder === DeepDivePaneOrderValue.StageCode
    ? DeepDiveStagePanePercentMax
    : 100 - DeepDiveStagePanePercentMin
  const firstPane = paneOrder === DeepDivePaneOrderValue.StageCode ? stagePane : codePane
  const secondPane = paneOrder === DeepDivePaneOrderValue.StageCode ? codePane : stagePane

  return (
    <Layer className="flex h-dvh flex-col overflow-hidden bg-stage-50 text-ink-900 antialiased">
      <CompactNav chrome={chrome} theme={theme} />
      <Section className="min-h-0 flex-1">
        <SplitPane
          dividerClassName={theme.splitDivider}
          first={firstPane}
          firstPanePercent={firstPanePercent}
          handleClassName={theme.splitHandle}
          maxPercent={firstPanePercentMax}
          minPercent={firstPanePercentMin}
          onFirstPanePercentChange={(nextPercent) => {
            onStagePanePercentChange(
              paneOrder === DeepDivePaneOrderValue.StageCode ? nextPercent : 100 - nextPercent
            )
          }}
          second={secondPane}
          compactActivePane={focusedPane === DeepDiveFocusedPaneValue.Source ? "second" : "first"}
          secondPaneVisible={sourcePaneVisible}
        />
      </Section>
    </Layer>
  )
}
