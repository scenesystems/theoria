import type { ReactNode } from "react"

import type {
  ProgramSourceScope,
  SourceFileTab,
  SourceWorkspaceTab,
  SurfaceVariant
} from "../../../contracts/presentation/program.js"

import { ActionButton } from "./ActionControl.js"
import type { CodePanel } from "./designSystem.js"
import { ProgramCodeWorkspace } from "./ProgramCodeWorkspace.js"
import { SurfacePlaneFrame } from "./SurfacePlaneFrame.js"
import { TabBar, TabButton } from "./TabBar.js"

export const ProgramCodePanel = ({
  badge,
  codeClassName,
  codePanel,
  entry,
  fileName,
  filesVisible,
  fileTabs,
  hintText,
  onSelectSourceScope,
  onToggleFilesVisible,
  onSelectFile,
  selectedSourceScope,
  selectedFileIndex,
  sourceTabs,
  source,
  summaryText,
  variant
}: {
  readonly badge?: ReactNode
  readonly codeClassName: string
  readonly codePanel: CodePanel
  readonly entry: string
  readonly fileName: string
  readonly filesVisible: boolean
  readonly fileTabs: ReadonlyArray<SourceFileTab>
  readonly hintText: string
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly onToggleFilesVisible: () => void
  readonly onSelectFile: (index: number) => void
  readonly selectedSourceScope: ProgramSourceScope
  readonly selectedFileIndex: number
  readonly sourceTabs: ReadonlyArray<SourceWorkspaceTab>
  readonly source: string
  readonly summaryText?: string
  readonly variant: SurfaceVariant
}) => {
  const optionalChromeProps = {
    ...(badge === undefined ? {} : { badge }),
    ...(summaryText === undefined ? {} : { summaryText })
  }

  return (
    <SurfacePlaneFrame
      {...optionalChromeProps}
      actions={
        <ActionButton
          className={codePanel.action}
          disabled={false}
          label={filesVisible ? "Hide Files" : "Show Files"}
          onClick={onToggleFilesVisible}
          variant={variant}
        />
      }
      contentClassName="min-h-0 flex-1"
      headerClassName={codePanel.metaBorder}
      hintText={hintText}
      meta={sourceTabs.length > 1
        ? (
          <TabBar className="flex-wrap">
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
        : undefined}
      title="Source"
      variant={variant}
    >
      <ProgramCodeWorkspace
        codeClassName={codeClassName}
        codePanel={codePanel}
        entry={entry}
        fileName={fileName}
        filesVisible={filesVisible}
        fileTabs={fileTabs}
        onSelectFile={onSelectFile}
        selectedFileIndex={selectedFileIndex}
        source={source}
        variant={variant}
      />
    </SurfacePlaneFrame>
  )
}
