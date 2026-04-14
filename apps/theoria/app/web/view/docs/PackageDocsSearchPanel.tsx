import { useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { Match } from "effect"
import { useRef } from "react"
import type { KeyboardEvent } from "react"

import { type PackageDocsSearchItem } from "../../../contracts/presentation/package-docs.js"
import { navigateToPackageDocsSearchItemAtom } from "../../atoms/package-docs-navigation.js"
import {
  packageDocsCurrentRouteKeyAtom,
  packageDocsCurrentSearchPresentationAtom,
  packageDocsSearchHighlightIndexAtom,
  packageDocsSearchPanelOpenAtom,
  packageDocsSearchQueryAtom,
  rememberPackageDocsSearchSelectionAtom
} from "../../atoms/package-docs.js"
import { SearchField } from "../../ui/components/form/SearchField.js"
import { Dialog } from "../../ui/components/overlay/Dialog.js"
import { Box, mergeClassNames } from "../../ui/structure/Box.js"
import { Cluster } from "../../ui/structure/Cluster.js"
import { Icon } from "../../ui/structure/Icon.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"
import {
  packageDocsSearchItemDomId,
  packageDocsSearchModelFromContent,
  PackageDocsSearchPanelNotice,
  PackageDocsSearchPanelResults
} from "./PackageDocsSearchPanelResults.js"

const packageDocsSearchPanelId = "package-docs-search-panel"

export const PackageDocsSearchPanel = ({
  onOpenChange,
  triggerClassName
}: {
  readonly onOpenChange?: (open: boolean) => void
  readonly triggerClassName?: string
} = {}) => {
  const routeKey = useAtomValue(packageDocsCurrentRouteKeyAtom)
  const [query, setQuery] = useAtom(packageDocsSearchQueryAtom)
  const [open, setOpen] = useAtom(packageDocsSearchPanelOpenAtom(routeKey))
  const [highlightIndex, setHighlightIndex] = useAtom(packageDocsSearchHighlightIndexAtom(routeKey))
  const rememberSelection = useAtomSet(rememberPackageDocsSearchSelectionAtom)
  const navigateToSearchItem = useAtomSet(navigateToPackageDocsSearchItemAtom)
  const content = useAtomValue(packageDocsCurrentSearchPresentationAtom)
  const model = packageDocsSearchModelFromContent(content)
  const resultsKey = `${routeKey}:${open ? "open" : "closed"}:${query.trim()}`
  const autoScrollActiveItemRef = useRef(false)
  const items = model?.presentationItems ?? []
  const activeIndex = items.length === 0 ? -1 : Math.max(0, Math.min(highlightIndex, items.length - 1))
  const activeItem = activeIndex === -1 ? null : items[activeIndex] ?? null

  const selectItem = (item: PackageDocsSearchItem): void => {
    rememberSelection(item)
    setHighlightIndex(0)
    setOpen(false)
    navigateToSearchItem(item)
  }

  return (
    <Dialog.Root
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        onOpenChange?.(nextOpen)
        if (nextOpen === false) {
          setHighlightIndex(0)
        }
      }}
      open={open}
    >
      <Dialog.Trigger
        className={mergeClassNames(
          "group flex h-11 w-full items-center gap-3 rounded-lg border border-stage-200/80 bg-stage-0/82 px-3.5 text-left shadow-chip transition-[border-color,background-color,box-shadow] duration-150 ease-out hover:border-stage-300 hover:bg-stage-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30",
          triggerClassName
        )}
      >
        <Icon
          className="text-ink-500 transition-colors duration-150 group-hover:text-ink-700"
          size="sm"
          source={MagnifyingGlassIcon}
        />
        <SemanticText
          as="span"
          className="min-w-0 flex-1 truncate text-ink-500 group-hover:text-ink-700"
          role="body-sm"
        >
          Search package docs
        </SemanticText>
        <Cluster
          className="hidden shrink-0 rounded-md border border-stage-200/80 bg-stage-50/90 px-2 py-1 text-ink-500 sm:inline-flex"
          gap="xs"
        >
          <SemanticText as="span" role="label">Cmd</SemanticText>
          <SemanticText as="span" role="label">K</SemanticText>
        </Cluster>
      </Dialog.Trigger>

      <Dialog.Portal keepMounted>
        <Dialog.Backdrop />
        <Dialog.Content className="w-[min(52rem,calc(100vw-1.5rem))] max-w-none overflow-hidden p-0">
          <Dialog.Title className="sr-only">{content.frame.title}</Dialog.Title>
          <Dialog.Description className="sr-only">{content.frame.summaryText}</Dialog.Description>

          <Stack className="gap-0">
            <Box className="border-b border-stage-200/80 bg-stage-0/98 p-3 sm:p-4">
              <SearchField
                active={query.trim().length > 0}
                activeDescendant={open && activeItem !== null ? packageDocsSearchItemDomId(activeItem) : undefined}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                autoFocus={open}
                controls={packageDocsSearchPanelId}
                disabled={false}
                expanded={open}
                inputClassName="min-h-12 rounded-[1.1rem] border-stage-200/95 bg-stage-0 px-4 text-sm shadow-none placeholder:text-ink-400"
                name="package-docs-command-search"
                onValueChange={(value) => {
                  autoScrollActiveItemRef.current = false
                  setQuery(value)
                  setHighlightIndex(0)
                }}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Escape") {
                    event.preventDefault()
                    setOpen(false)
                    return
                  }

                  if (event.key === "Enter" && activeItem !== null) {
                    event.preventDefault()
                    selectItem(activeItem)
                    return
                  }

                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
                    return
                  }

                  if (items.length === 0) {
                    autoScrollActiveItemRef.current = false
                    return
                  }

                  event.preventDefault()
                  autoScrollActiveItemRef.current = true
                  setHighlightIndex(
                    event.key === "ArrowDown"
                      ? (activeIndex + 1) % items.length
                      : (activeIndex + items.length - 1) % items.length
                  )
                }}
                placeholder={content.frame.placeholderText}
                spellCheck={false}
                type="text"
                value={query}
              />
            </Box>

            <Box
              className="max-h-[min(68vh,42rem)] overflow-y-auto bg-stage-50/96"
              id={packageDocsSearchPanelId}
            >
              {Match.value(content).pipe(
                Match.tag("OpenEmpty", ({ model }) =>
                  model.lanes.length === 0
                    ? <PackageDocsSearchPanelNotice text={content.frame.summaryText} />
                    : (
                      <PackageDocsSearchPanelResults
                        activeItem={activeItem}
                        autoScrollActiveItem={autoScrollActiveItemRef.current}
                        key={resultsKey}
                        model={model}
                        onHighlight={(item) => {
                          autoScrollActiveItemRef.current = false
                          setHighlightIndex(model.presentationItems.findIndex((candidate) => candidate.id === item.id))
                        }}
                        onSelect={selectItem}
                      />
                    )),
                Match.tag("LoadingInitial", ({ statusText }) => <PackageDocsSearchPanelNotice text={statusText} />),
                Match.tag("RefreshingStale", ({ model, statusText }) => (
                  <PackageDocsSearchPanelResults
                    activeItem={activeItem}
                    autoScrollActiveItem={autoScrollActiveItemRef.current}
                    key={resultsKey}
                    model={model}
                    notice={<PackageDocsSearchPanelNotice text={statusText} />}
                    onHighlight={(item) => {
                      autoScrollActiveItemRef.current = false
                      setHighlightIndex(items.findIndex((candidate) => candidate.id === item.id))
                    }}
                    onSelect={selectItem}
                  />
                )),
                Match.tag(
                  "ErrorEmpty",
                  ({ description }) => <PackageDocsSearchPanelNotice danger text={description} />
                ),
                Match.tag("ErrorWithStale", ({ description, model }) => (
                  <PackageDocsSearchPanelResults
                    activeItem={activeItem}
                    autoScrollActiveItem={autoScrollActiveItemRef.current}
                    key={resultsKey}
                    model={model}
                    notice={<PackageDocsSearchPanelNotice danger text={description} />}
                    onHighlight={(item) => {
                      autoScrollActiveItemRef.current = false
                      setHighlightIndex(items.findIndex((candidate) => candidate.id === item.id))
                    }}
                    onSelect={selectItem}
                  />
                )),
                Match.tag("Ready", ({ model }) => (
                  <PackageDocsSearchPanelResults
                    activeItem={activeItem}
                    autoScrollActiveItem={autoScrollActiveItemRef.current}
                    key={resultsKey}
                    model={model}
                    onHighlight={(item) => {
                      autoScrollActiveItemRef.current = false
                      setHighlightIndex(items.findIndex((candidate) => candidate.id === item.id))
                    }}
                    onSelect={selectItem}
                  />
                )),
                Match.exhaustive
              )}
            </Box>
          </Stack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
