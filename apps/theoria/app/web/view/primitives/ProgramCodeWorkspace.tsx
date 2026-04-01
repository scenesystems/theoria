import { Button } from "@base-ui-components/react/button"
import { ScrollArea } from "@base-ui-components/react/scroll-area"
import { Match } from "effect"
import * as Arr from "effect/Array"

import type { SourceFileTab, SurfaceVariant } from "../../../contracts/presentation.js"

import { HighlightedCode } from "./code/HighlightedCode.js"
import type { CodePanelTheme } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

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
  codePanelTheme,
  node,
  onSelectFile,
  selectedFileIndex,
  variant
}: {
  readonly codePanelTheme: CodePanelTheme
  readonly node: ExplorerDirectoryNode
  readonly onSelectFile: (index: number) => void
  readonly selectedFileIndex: number
  readonly variant: SurfaceVariant
}) => (
  <Stack className="gap-1">
    <Layer className="px-2 py-1">
      <SemanticText
        as="span"
        className={codePanelTheme.metaHint}
        role="code-meta"
        text={node.name}
        variant={variant}
      />
    </Layer>
    <ExplorerTree
      codePanelTheme={codePanelTheme}
      nested
      nodes={node.children}
      onSelectFile={onSelectFile}
      selectedFileIndex={selectedFileIndex}
      variant={variant}
    />
  </Stack>
)

const ExplorerTree = ({
  codePanelTheme,
  nested = false,
  nodes,
  onSelectFile,
  selectedFileIndex,
  variant
}: {
  readonly codePanelTheme: CodePanelTheme
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
            codePanelTheme={codePanelTheme}
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
            codePanelTheme={codePanelTheme}
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
  codePanelTheme
}: {
  readonly active: boolean
  readonly codePanelTheme: CodePanelTheme
}): string => active ? codePanelTheme.explorerItemActive : codePanelTheme.explorerItem

const ExplorerFileButton = ({
  active,
  codePanelTheme,
  onClick,
  tab,
  variant
}: {
  readonly active: boolean
  readonly codePanelTheme: CodePanelTheme
  readonly onClick: () => void
  readonly tab: SourceFileTab
  readonly variant: SurfaceVariant
}) => (
  <Button
    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
      explorerButtonClassName({ active, codePanelTheme })
    }`}
    onClick={onClick}
    type="button"
  >
    <SemanticText as="code" className="block truncate" role="code-meta" text={tab.name} variant={variant} />
  </Button>
)

export const ProgramCodeWorkspace = ({
  codeClassName,
  codePanelTheme,
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
  readonly codePanelTheme: CodePanelTheme
  readonly entry: string
  readonly fileName: string
  readonly filesVisible: boolean
  readonly fileTabs: ReadonlyArray<SourceFileTab>
  readonly onSelectFile: (index: number) => void
  readonly selectedFileIndex: number
  readonly source: string
  readonly variant: SurfaceVariant
}) => (
  <Layer className={`min-h-0 flex-1 overflow-hidden ${codePanelTheme.workspace}`}>
    <Layer
      className={filesVisible
        ? `grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(14rem,16rem)_minmax(0,1fr)] ${codePanelTheme.metaBorder}`
        : `grid h-full min-h-0 grid-cols-1 ${codePanelTheme.metaBorder}`}
    >
      {filesVisible
        ? (
          <Stack
            className={`min-h-0 border-b lg:border-r lg:border-b-0 ${codePanelTheme.explorer} ${codePanelTheme.metaBorder}`}
          >
            <Cluster className={`justify-between gap-2 border-b px-3 py-3 ${codePanelTheme.metaBorder}`}>
              <SemanticText
                as="span"
                className={codePanelTheme.metaLabel}
                role="code-meta"
                text="Files"
                variant={variant}
              />
            </Cluster>
            <ScrollArea.Root className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea.Viewport className="h-full w-full">
                <ScrollArea.Content className="px-3 py-3">
                  <ExplorerTree
                    codePanelTheme={codePanelTheme}
                    nodes={explorerTree(fileTabs)}
                    onSelectFile={onSelectFile}
                    selectedFileIndex={selectedFileIndex}
                    variant={variant}
                  />
                </ScrollArea.Content>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar
                className={`flex w-2.5 touch-none select-none p-0.5 ${codePanelTheme.scrollbar}`}
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
          className={`gap-1 border-b px-4 py-3 sm:px-5 ${codePanelTheme.editorHeader} ${codePanelTheme.metaBorder}`}
        >
          <SemanticText
            as="code"
            className={`block truncate ${codePanelTheme.title}`}
            role="code-meta"
            text={fileName}
            variant={variant}
          />
          <SemanticText
            as="code"
            className={`block truncate ${codePanelTheme.metaValue}`}
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
            className={`flex w-2.5 touch-none select-none p-0.5 ${codePanelTheme.scrollbar}`}
            orientation="vertical"
          >
            <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/35" />
          </ScrollArea.Scrollbar>

          <ScrollArea.Scrollbar
            className={`flex h-2.5 touch-none select-none p-0.5 ${codePanelTheme.scrollbar}`}
            orientation="horizontal"
          >
            <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/35" />
          </ScrollArea.Scrollbar>

          <ScrollArea.Corner className={codePanelTheme.scrollCorner} />
        </ScrollArea.Root>
      </Stack>
    </Layer>
  </Layer>
)
