import { Match } from "effect"
import type { MouseEvent, ReactNode } from "react"

import {
  type PackageDocsSearchItem,
  type PackageDocsSearchModel,
  type PackageDocsSearchPanelContent
} from "../../../contracts/presentation/package-docs.js"
import { Box, mergeClassNames } from "../../ui/structure/Box.js"
import { Cluster } from "../../ui/structure/Cluster.js"
import { Link } from "../../ui/structure/Link.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

import { PackageDocsInlineContent } from "./PackageDocsMarkdown.js"

export const packageDocsSearchItemDomId = (item: PackageDocsSearchItem): string =>
  `package-docs-search-item-${encodeURIComponent(item.id)}`

export const packageDocsSearchModelFromContent = (
  content: PackageDocsSearchPanelContent
): PackageDocsSearchModel | null =>
  Match.value(content).pipe(
    Match.tag("OpenEmpty", ({ model }) => model),
    Match.tag("LoadingInitial", () => null),
    Match.tag("RefreshingStale", ({ model }) => model),
    Match.tag("ErrorEmpty", () => null),
    Match.tag("ErrorWithStale", ({ model }) => model),
    Match.tag("Ready", ({ model }) => model),
    Match.exhaustive
  )

export const PackageDocsSearchPanelNotice = ({
  className,
  danger = false,
  text
}: {
  readonly className?: string
  readonly danger?: boolean
  readonly text: string
}) => (
  <Box
    className={mergeClassNames(
      danger
        ? "rounded-lg border border-danger-200/70 bg-danger-50/70 px-3 py-3"
        : "rounded-lg border border-stage-200/70 bg-stage-0/70 px-3 py-3",
      className
    )}
  >
    <Cluster className="items-center gap-2">
      <Box
        className={danger ? "size-2 rounded-full bg-danger-500" : "size-2 rounded-full bg-stage-400 animate-pulse"}
      />
      <SemanticText as="p" className={danger ? "text-danger-700" : "text-ink-500"} role="label">
        {text}
      </SemanticText>
    </Cluster>
  </Box>
)

const SearchResultRow = ({
  active,
  autoScrollWhenActive,
  item,
  onHighlight,
  onSelect
}: {
  readonly active: boolean
  readonly autoScrollWhenActive: boolean
  readonly item: PackageDocsSearchItem
  readonly onHighlight: () => void
  readonly onSelect: (item: PackageDocsSearchItem) => void
}) => {
  const selectResult = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
      return
    }

    event.preventDefault()
    onSelect(item)
  }

  return (
    <Box
      as="article"
      className={active
        ? "border-t border-stage-300/90 bg-stage-0 ring-1 ring-inset ring-stage-300/60 transition-[background-color,border-color,box-shadow] duration-150 ease-out first:border-t-0"
        : "border-t border-stage-200/70 bg-stage-0/78 transition-[background-color,border-color] duration-150 ease-out hover:bg-stage-0/92 first:border-t-0"}
      onFocusCapture={onHighlight}
      onMouseEnter={onHighlight}
      ref={(node: HTMLDivElement | null) => {
        if (active && autoScrollWhenActive && node !== null) {
          node.scrollIntoView({ block: "nearest" })
        }
      }}
    >
      <Stack className="gap-3 px-4 py-4 sm:px-5">
        <Cluster className="items-start justify-between gap-3">
          <Stack className="min-w-0 flex-1 gap-2">
            <Cluster className="items-center gap-2">
              <SemanticText
                as="span"
                className="rounded-full border border-stage-200/80 bg-stage-0/88 px-2 py-1 text-ink-500"
                role="badge"
              >
                {item.kindLabel}
              </SemanticText>
              <SemanticText as="span" className="text-ink-500" role="label">{item.packageId}</SemanticText>
            </Cluster>
            <Link
              className="text-ink-900 underline decoration-stage-300 underline-offset-4"
              href={item.href}
              id={packageDocsSearchItemDomId(item)}
              onClick={selectResult}
              tone="inherit"
            >
              <Box as="span" className="min-w-0 flex-1 text-[1.02rem] font-medium leading-6 text-ink-900">
                <PackageDocsInlineContent document={item.titleDocument} />
              </Box>
            </Link>
          </Stack>
          <Link
            className="text-ink-500 no-underline"
            href={item.sourceHref}
            onClick={(event) => {
              event.stopPropagation()
            }}
            rel="noopener noreferrer"
            target="_blank"
            tone="inherit"
          >
            <SemanticText as="span" role="label">{item.sourceLabel}</SemanticText>
          </Link>
        </Cluster>
        <Box className="text-sm leading-6 text-ink-700">
          <PackageDocsInlineContent document={item.excerptDocument} />
        </Box>
      </Stack>
    </Box>
  )
}

export const PackageDocsSearchPanelResults = ({
  model,
  activeItem,
  autoScrollActiveItem,
  notice,
  onHighlight,
  onSelect
}: {
  readonly activeItem: PackageDocsSearchItem | null
  readonly autoScrollActiveItem: boolean
  readonly model: PackageDocsSearchModel
  readonly notice?: ReactNode
  readonly onHighlight: (item: PackageDocsSearchItem) => void
  readonly onSelect: (item: PackageDocsSearchItem) => void
}) => (
  <Stack className="max-h-[28rem] gap-0 overflow-y-auto">
    {notice === undefined
      ? null
      : <Box className="border-b border-stage-200/80 px-4 py-3 sm:px-5">{notice}</Box>}
    {model.resultSummary.length === 0
      ? null
      : (
        <SemanticText as="p" className="border-b border-stage-200/80 px-4 py-3 text-ink-500 sm:px-5" role="label">
          {model.resultSummary}
        </SemanticText>
      )}
    <Stack className="gap-0">
      {model.lanes.map((lane) => (
        <Box className="border-b border-stage-200/80 last:border-b-0" key={lane.kind}>
          <Stack className="gap-0">
            <Stack className="gap-0.5 px-4 py-3 sm:px-5">
              <SemanticText as="p" role="label">{lane.title}</SemanticText>
              {lane.summary.length === 0
                ? null
                : <SemanticText as="p" className="text-ink-500" role="body-sm">{lane.summary}</SemanticText>}
            </Stack>
            <Box className="overflow-hidden">
              {lane.items.map((item) => (
                <SearchResultRow
                  active={activeItem?.id === item.id}
                  autoScrollWhenActive={autoScrollActiveItem}
                  item={item}
                  key={item.id}
                  onHighlight={() => {
                    onHighlight(item)
                  }}
                  onSelect={onSelect}
                />
              ))}
            </Box>
          </Stack>
        </Box>
      ))}
    </Stack>
  </Stack>
)
