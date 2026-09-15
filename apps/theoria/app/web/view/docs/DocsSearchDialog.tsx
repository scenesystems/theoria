import { Button } from "@base-ui/react/button"
import { Combobox } from "@base-ui/react/combobox"
import { Dialog } from "@base-ui/react/dialog"
import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
import * as Arr from "effect/Array"

import { type DocsManifest, type DocsSearchEntry, searchDocs } from "@theoria/docs-model"
import { docsSearchIndexAtom } from "../../atoms/docs-data.js"
import { docsSearchOpenAtom, docsSearchQueryAtom, setDocsSearchOpenAtom } from "../../atoms/docs.js"
import { navigateAtom } from "../../atoms/navigation.js"
import { ActionButton } from "../primitives/ActionControl.js"
import {
  dialogBackdropClassName,
  dialogSheetClassName,
  dialogViewportClassName,
  firmUnderPointerClassName,
  focusClassName,
  focusEdgeClassName,
  iconButtonClassName,
  pickerTriggerClassName,
  respondColorsClassName,
  secondaryActionClassName
} from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { semanticClassName } from "../primitives/semanticTextClasses.js"

export const DocsSearchTrigger = () => {
  const setOpen = useAtomSet(setDocsSearchOpenAtom)

  return (
    <Button
      aria-label="Search documentation"
      className={`${pickerTriggerClassName} w-11 justify-center sm:w-56 sm:justify-start`}
      onClick={() => setOpen(true)}
      type="button"
    >
      <MagnifyingGlassIcon aria-hidden className="h-4 w-4 shrink-0" />
      <SemanticText as="span" className="hidden min-w-0 flex-1 text-left sm:block" role="button-label" text="Search" />
      <SemanticText
        as="kbd"
        className="hidden rounded-mark border border-hairline bg-canvas px-1.5 py-0.5 text-ink-tertiary sm:block"
        role="code-meta"
        text="⌘K"
      />
    </Button>
  )
}

const resultHref = (entry: DocsSearchEntry): string =>
  `${entry.path}${Option.match(entry.anchor, { onNone: () => "", onSome: (anchor) => `#${anchor}` })}`

const SearchCombobox = ({
  activePackageSlug,
  manifest
}: {
  readonly activePackageSlug: Option.Option<string>
  readonly manifest: DocsManifest
}) => {
  const query = useAtomValue(docsSearchQueryAtom)
  const navigate = useAtomSet(navigateAtom)
  const setOpen = useAtomSet(setDocsSearchOpenAtom)
  const setQuery = useAtomSet(docsSearchQueryAtom)
  const searchAtom = docsSearchIndexAtom(manifest.searchIndexAsset)
  const searchIndex = useAtomValue(searchAtom)
  const refresh = useAtomRefresh(searchAtom)
  const results: ReadonlyArray<DocsSearchEntry> = Result.match(searchIndex, {
    onInitial: () => Arr.empty<DocsSearchEntry>(),
    onFailure: () => Arr.empty<DocsSearchEntry>(),
    onSuccess: ({ value }) => searchDocs(value, query, { limit: 20, packageSlug: activePackageSlug })
  })

  return (
    <Combobox.Root
      autoHighlight
      inputValue={query}
      itemToStringLabel={(entry: DocsSearchEntry) => entry.name}
      items={results}
      onInputValueChange={setQuery}
      onValueChange={(entry) => {
        Option.fromNullable(entry).pipe(
          Option.map((value) => {
            navigate(resultHref(value))
            setOpen(false)
          })
        )
      }}
    >
      <Cluster className="gap-3 border-b border-hairline-veil p-3 sm:p-4">
        <Layer className="min-w-0 flex-1">
          <Combobox.Input
            aria-label="Search"
            autoFocus
            className={`h-11 w-full rounded-instrument border border-hairline-veil bg-canvas-glass px-4 ${
              semanticClassName("body", "expanded")
            } ${focusClassName} placeholder:text-ink-tertiary`}
            placeholder="Package, module, or symbol"
          />
        </Layer>
        <Dialog.Close aria-label="Close search" className={iconButtonClassName}>
          <XMarkIcon aria-hidden className="h-5 w-5" />
        </Dialog.Close>
      </Cluster>
      {Result.match(searchIndex, {
        onInitial: () => (
          <Stack className="gap-2 px-5 py-10">
            <SemanticText as="p" className="text-ink-tertiary" role="row-value" text="Loading search…" />
          </Stack>
        ),
        onFailure: () => (
          <Stack className="gap-2 px-5 py-10">
            <SemanticText as="p" role="row-label" text="Search unavailable" />
            <ActionButton
              className={secondaryActionClassName}
              disabled={false}
              label="Try again"
              onClick={refresh}
              variant="expanded"
            />
          </Stack>
        ),
        onSuccess: () =>
          Arr.match(results, {
            onEmpty: () => (
              <Stack className="items-center gap-2 px-5 py-10 text-center">
                <MagnifyingGlassIcon aria-hidden className="h-6 w-6 text-ink-tertiary" />
                <SemanticText as="p" role="row-label" text="No results" />
                <SemanticText
                  as="p"
                  className="text-ink-tertiary"
                  role="row-value"
                  text="Try a package, module, or symbol."
                />
              </Stack>
            ),
            onNonEmpty: (entries) => (
              <Combobox.List className="max-h-[30rem] overflow-y-auto p-2 sm:p-3">
                {Arr.map(entries, (entry, index) => (
                  <Combobox.Item
                    className={`group rounded-instrument ${respondColorsClassName} ${focusEdgeClassName} ${firmUnderPointerClassName} data-[highlighted]:bg-instrument-glass`}
                    index={index}
                    key={entry.id}
                    render={
                      <InternalLink
                        className="flex min-w-0 items-center gap-3 px-3 py-3 text-ink-secondary"
                        href={resultHref(entry)}
                        onClick={() => setOpen(false)}
                      />
                    }
                    value={entry}
                  >
                    <Stack className="min-w-0 flex-1 gap-0.5">
                      <SemanticText as="span" className="text-ink" role="button-label" text={entry.name} />
                      <SemanticText
                        as="span"
                        className="truncate text-ink-tertiary"
                        role="code-meta"
                        text={entry.qualifiedName}
                      />
                    </Stack>
                    <SemanticText as="span" role="row-label" text={entry.kind} />
                  </Combobox.Item>
                ))}
              </Combobox.List>
            )
          })
      })}
    </Combobox.Root>
  )
}

export const DocsSearchDialog = ({
  activePackageSlug,
  manifest
}: {
  readonly activePackageSlug: Option.Option<string>
  readonly manifest: DocsManifest
}) => {
  const open = useAtomValue(docsSearchOpenAtom)
  const setOpen = useAtomSet(setDocsSearchOpenAtom)

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdropClassName} />
        <Dialog.Viewport className={dialogViewportClassName}>
          <Dialog.Popup className={`w-full max-w-[42rem] ${dialogSheetClassName}`}>
            <Stack className="gap-0">
              <Dialog.Title render={<SemanticText as="h2" className="sr-only" role="hero-title" text="Search" />} />
              <Dialog.Description
                render={
                  <SemanticText as="p" className="sr-only" role="row-value" text="Search Theoria packages and APIs." />
                }
              />
              <SearchCombobox activePackageSlug={activePackageSlug} manifest={manifest} />
            </Stack>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
