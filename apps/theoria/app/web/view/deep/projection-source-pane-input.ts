import type { ReactNode } from "react"

import type { DeepDiveProjectionSurfaceContext } from "./projection-surface-context.js"

import type { Surface } from "../primitives/theme/surface.js"

type ProjectionSourcePaneChrome = {
  readonly badge: ReactNode | null
  readonly hintText: string
  readonly summaryText: string
}

export const projectionSourcePaneInput = ({
  chrome,
  context,
  theme
}: {
  readonly chrome: ProjectionSourcePaneChrome
  readonly context: DeepDiveProjectionSurfaceContext
  readonly theme: Surface
}) => ({
  ...(chrome.badge === null ? {} : { badge: chrome.badge }),
  codeClassName: theme.codePanel.codeContainer,
  codePanel: theme.codePanel,
  entry: context.frameViewModel.code.entry,
  fileName: context.frameViewModel.code.fileName,
  filesVisible: context.sourceExplorerVisible,
  fileTabs: context.frameViewModel.code.fileTabs,
  hintText: chrome.hintText,
  onSelectFile: context.onSelectFile,
  onSelectSourceScope: context.onSelectSourceScope,
  onToggleFilesVisible: context.onToggleSourceExplorerVisible,
  selectedFileIndex: context.frameViewModel.code.selectedFileIndex,
  selectedSourceScope: context.frameViewModel.code.selectedSourceScope,
  source: context.frameViewModel.code.source,
  sourceTabs: context.frameViewModel.code.sourceTabs,
  summaryText: chrome.summaryText
})
