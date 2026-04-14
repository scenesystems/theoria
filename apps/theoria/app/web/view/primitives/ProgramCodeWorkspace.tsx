import { Button } from "@base-ui/react/button"
import { ScrollArea } from "@base-ui/react/scroll-area"
import { Match } from "effect"
import * as Arr from "effect/Array"

import type { SourceFileTab, SurfaceVariant } from "../../../contracts/presentation/program.js"

import { HighlightedCode } from "./code/HighlightedCode.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import type { CodePanel } from "./theme/surface.js"

type ExplorerFileNode = {
  readonly _tag: "file"
  readonly tab: SourceFileTab
}

type ExplorerDirectoryNode = {
  readonly _tag: "directory"
  readonly children: ReadonlyArray<ExplorerNode>
  readonly name: string
}

type ExplorerNode = ExplorerDirectoryNode | ExplorerFileNode

const emptySegments: ReadonlyArray<string> = []

const fileNode = (tab: SourceFileTab): ExplorerFileNode => ({ _tag: "file", tab })

const directoryNode = ({
  children,
  name
}: {
  readonly children: ReadonlyArray<ExplorerNode>
  readonly name: string
}): ExplorerDirectoryNode => ({ _tag: "directory", children, name })

const pathSegments = (tab: SourceFileTab): ReadonlyArray<string> => tab.entry.split("/")

const uniqueDirectoryNames = (tabs: ReadonlyArray<SourceFileTab>, depth: number): ReadonlyArray<string> =>
  Arr.reduce(tabs, emptySegments, (names, tab) => {
    const segments = pathSegments(tab)
    const directoryName = segments[depth]

    return directoryName === undefined || segments.length <= depth + 1 || names.includes(directoryName)
      ? names
      : [...names, directoryName]
  })

const explorerTree = (tabs: ReadonlyArray<SourceFileTab>, depth = 0): ReadonlyArray<ExplorerNode> => {
  const directoryNodes = Arr.map(uniqueDirectoryNames(tabs, depth), (name) =>
    directoryNode({
      children: explorerTree(
        Arr.filter(tabs, (tab) => {
          const segments = pathSegments(tab)
          return segments[depth] === name && segments.length > depth + 1
        }),
        depth + 1
      ),
      name
    }))
  const fileNodes = Arr.map(
    Arr.filter(tabs, (tab) => pathSegments(tab).length === depth + 1),
    fileNode
  )

  return [...directoryNodes, ...fileNodes]
}

const treeIndentClassName = (nested: boolean): string =>
  nested ? "ml-3 gap-1 border-l border-stage-200/60 pl-3" : "gap-1"

const DirectoryNode = ({
  codePanel,
  node,
  onSelectFile,
  selectedFileIndex,
  variant
}: {
  readonly codePanel: CodePanel
  readonly node: ExplorerDirectoryNode
  readonly onSelectFile: (index: number) => void
  readonly selectedFileIndex: number
  readonly variant: SurfaceVariant
}) => (
  <Stack className="gap-1">
    <Layer className="px-2 py-1">
      <SemanticText
        as="span"
        className={codePanel.metaHint}
        role="code-meta"
        text={node.name}
        variant={variant}
      />
    </Layer>
    <ExplorerTree
      codePanel={codePanel}
      nested
      nodes={node.children}
      onSelectFile={onSelectFile}
      selectedFileIndex={selectedFileIndex}
      variant={variant}
    />
  </Stack>
)

const ExplorerTree = ({
  codePanel,
  nested = false,
  nodes,
  onSelectFile,
  selectedFileIndex,
  variant
}: {
  readonly codePanel: CodePanel
  readonly nested?: boolean
  readonly nodes: ReadonlyArray<ExplorerNode>
  readonly onSelectFile: (index: number) => void
  readonly selectedFileIndex: number
  readonly variant: SurfaceVariant
}) => (
  <Stack className={treeIndentClassName(nested)}>
    {nodes.map((node, index) =>
      Match.value(node).pipe(
        Match.tag("directory", (directoryNode) => (
          <DirectoryNode
            codePanel={codePanel}
            key={`${directoryNode.name}:${index}`}
            node={directoryNode}
            onSelectFile={onSelectFile}
            selectedFileIndex={selectedFileIndex}
            variant={variant}
          />
        )),
        Match.tag("file", (fileNode) => (
          <ExplorerFileButton
            active={fileNode.tab.index === selectedFileIndex}
            codePanel={codePanel}
            key={fileNode.tab.index}
            onClick={() => {
              onSelectFile(fileNode.tab.index)
            }}
            tab={fileNode.tab}
            variant={variant}
          />
        )),
        Match.exhaustive
      )
    )}
  </Stack>
)

const explorerButtonClassName = ({
  active,
  codePanel
}: {
  readonly active: boolean
  readonly codePanel: CodePanel
}): string => active ? codePanel.explorerItemActive : codePanel.explorerItem

const ExplorerFileButton = ({
  active,
  codePanel,
  onClick,
  tab,
  variant
}: {
  readonly active: boolean
  readonly codePanel: CodePanel
  readonly onClick: () => void
  readonly tab: SourceFileTab
  readonly variant: SurfaceVariant
}) => (
  <Button
    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
      explorerButtonClassName({ active, codePanel })
    }`}
    onClick={onClick}
    type="button"
  >
    <SemanticText as="code" className="block truncate" role="code-meta" text={tab.name} variant={variant} />
  </Button>
)

export const ProgramCodeWorkspace = ({
  codeClassName,
  codePanel,
  entry,
  fileName,
  filesVisible,
  fileTabs,
  onSelectFile,
  selectedFileIndex,
  source,
  variant
}: {
  readonly codeClassName: string
  readonly codePanel: CodePanel
  readonly entry: string
  readonly fileName: string
  readonly filesVisible: boolean
  readonly fileTabs: ReadonlyArray<SourceFileTab>
  readonly onSelectFile: (index: number) => void
  readonly selectedFileIndex: number
  readonly source: string
  readonly variant: SurfaceVariant
}) => (
  <Layer className={`min-h-0 flex-1 overflow-hidden ${codePanel.workspace}`}>
    <Layer
      className={filesVisible
        ? `grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(14rem,16rem)_minmax(0,1fr)] ${codePanel.metaBorder}`
        : `grid h-full min-h-0 grid-cols-1 ${codePanel.metaBorder}`}
    >
      {filesVisible
        ? (
          <Stack
            className={`min-h-0 border-b lg:border-r lg:border-b-0 ${codePanel.explorer} ${codePanel.metaBorder}`}
          >
            <Cluster className={`justify-between gap-2 border-b px-3 py-3 ${codePanel.metaBorder}`}>
              <SemanticText
                as="span"
                className={codePanel.metaLabel}
                role="code-meta"
                text="Files"
                variant={variant}
              />
            </Cluster>
            <ScrollArea.Root className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea.Viewport className="h-full w-full">
                <ScrollArea.Content className="px-3 py-3">
                  <ExplorerTree
                    codePanel={codePanel}
                    nodes={explorerTree(fileTabs)}
                    onSelectFile={onSelectFile}
                    selectedFileIndex={selectedFileIndex}
                    variant={variant}
                  />
                </ScrollArea.Content>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar
                className={`flex w-2.5 touch-none select-none p-0.5 ${codePanel.scrollbar}`}
                orientation="vertical"
              >
                <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/35" />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Stack>
        )
        : null}

      <Stack className="min-h-0 flex-1 overflow-hidden">
        <Stack
          className={`gap-1 border-b px-4 py-3 sm:px-5 ${codePanel.editorHeader} ${codePanel.metaBorder}`}
        >
          <SemanticText
            as="code"
            className={`block truncate ${codePanel.title}`}
            role="code-meta"
            text={fileName}
            variant={variant}
          />
          <SemanticText
            as="code"
            className={`block truncate ${codePanel.metaValue}`}
            role="code-meta"
            text={entry}
            variant={variant}
          />
        </Stack>

        <ScrollArea.Root className={`min-h-0 flex-1 overflow-hidden ${codeClassName}`}>
          <ScrollArea.Viewport className="h-full w-full">
            <ScrollArea.Content className="w-max min-w-full px-4 py-4 sm:px-5 sm:py-5">
              <Layer as="pre" className="m-0">
                <HighlightedCode source={source} variant={variant} />
              </Layer>
            </ScrollArea.Content>
          </ScrollArea.Viewport>

          <ScrollArea.Scrollbar
            className={`flex w-2.5 touch-none select-none p-0.5 ${codePanel.scrollbar}`}
            orientation="vertical"
          >
            <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/35" />
          </ScrollArea.Scrollbar>

          <ScrollArea.Scrollbar
            className={`flex h-2.5 touch-none select-none p-0.5 ${codePanel.scrollbar}`}
            orientation="horizontal"
          >
            <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/35" />
          </ScrollArea.Scrollbar>

          <ScrollArea.Corner className={codePanel.scrollCorner} />
        </ScrollArea.Root>
      </Stack>
    </Layer>
  </Layer>
)
