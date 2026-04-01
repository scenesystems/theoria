import { ArrowsRightLeftIcon } from "@heroicons/react/20/solid"

import type { DeepDiveFocusedPane } from "../../../contracts/layout.js"
import { DeepDiveFocusedPaneValue } from "../../../contracts/layout.js"
import type {
  ProgramSourceScope,
  SourceFileTab,
  SourceWorkspaceTab,
  SurfaceVariant
} from "../../../contracts/presentation.js"

import { ActionButton } from "./ActionControl.js"
import { type CodePanelTheme, neutralBadgeTheme } from "./designSystem.js"
import { Cluster, Stack } from "./Layout.js"
import { PackageBadge } from "./PackageBadge.js"
import { ProgramCodeWorkspace } from "./ProgramCodeWorkspace.js"
import { SemanticText } from "./SemanticText.js"
import { TabBar, TabButton } from "./TabBar.js"

export const ProgramCodePanel = ({
  codeClassName,
  codePanelTheme,
  entry,
  fileName,
  filesVisible,
  fileTabs,
  focusedPane,
  onFocusStagePane,
  onHideSourcePane,
  onSelectSourceScope,
  onToggleFilesVisible,
  onSwapSide,
  onSelectFile,
  originLabel,
  selectedSourceScope,
  selectedFileIndex,
  sourceTabs,
  source,
  swapSideLabel,
  variant
}: {
  readonly codeClassName: string
  readonly codePanelTheme: CodePanelTheme
  readonly entry: string
  readonly fileName: string
  readonly filesVisible: boolean
  readonly fileTabs: ReadonlyArray<SourceFileTab>
  readonly focusedPane: DeepDiveFocusedPane
  readonly onFocusStagePane?: (() => void) | undefined
  readonly onHideSourcePane?: (() => void) | undefined
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly onToggleFilesVisible: () => void
  readonly onSwapSide?: (() => void) | undefined
  readonly onSelectFile: (index: number) => void
  readonly originLabel: string
  readonly selectedSourceScope: ProgramSourceScope
  readonly selectedFileIndex: number
  readonly sourceTabs: ReadonlyArray<SourceWorkspaceTab>
  readonly source: string
  readonly swapSideLabel?: string | undefined
  readonly variant: SurfaceVariant
}) => (
  <Stack className={`min-h-0 h-full flex-1 ${codePanelTheme.workspace}`}>
    <Stack className={`gap-3 border-b px-4 py-3 sm:px-5 ${codePanelTheme.metaBorder}`}>
      <Cluster className="items-start justify-between gap-3">
        <Stack className="gap-2">
          <Cluster className="items-center gap-2">
            <SemanticText
              as="h3"
              className="text-ink-900"
              role="section-title"
              text="Source"
              variant={variant}
            />
            {sourceTabs.length > 1
              ? (
                <TabBar>
                  {sourceTabs.map((tab) => (
                    <TabButton
                      active={tab.scope === selectedSourceScope}
                      key={tab.scope}
                      label={tab.label}
                      onClick={() => {
                        onSelectSourceScope(tab.scope)
                      }}
                    />
                  ))}
                </TabBar>
              )
              : (
                <PackageBadge
                  badge={neutralBadgeTheme}
                  label={originLabel}
                  variant={variant}
                />
              )}
          </Cluster>
        </Stack>
        <Cluster className="items-center justify-end gap-2">
          <ActionButton
            className={codePanelTheme.action}
            disabled={false}
            label={filesVisible ? "Hide Files" : "Show Files"}
            onClick={onToggleFilesVisible}
            variant={variant}
          />
          {onSwapSide === undefined || swapSideLabel === undefined
            ? null
            : (
              <ActionButton
                className={`max-lg:hidden ${codePanelTheme.action}`}
                disabled={false}
                icon={<ArrowsRightLeftIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />}
                label={swapSideLabel}
                onClick={onSwapSide}
                variant={variant}
              />
            )}
          {onFocusStagePane === undefined || focusedPane !== DeepDiveFocusedPaneValue.Source
            ? null
            : (
              <ActionButton
                className={`lg:hidden ${codePanelTheme.action}`}
                disabled={false}
                label="Back to Stage"
                onClick={onFocusStagePane}
                variant={variant}
              />
            )}
          {onHideSourcePane === undefined
            ? null
            : (
              <ActionButton
                className={codePanelTheme.action}
                disabled={false}
                label="Hide Source"
                onClick={onHideSourcePane}
                variant={variant}
              />
            )}
        </Cluster>
      </Cluster>
    </Stack>
    <ProgramCodeWorkspace
      codeClassName={codeClassName}
      codePanelTheme={codePanelTheme}
      entry={entry}
      fileName={fileName}
      filesVisible={filesVisible}
      fileTabs={fileTabs}
      onSelectFile={onSelectFile}
      selectedFileIndex={selectedFileIndex}
      source={source}
      variant={variant}
    />
  </Stack>
)
