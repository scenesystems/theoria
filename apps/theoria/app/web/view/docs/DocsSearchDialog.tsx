import { Button } from "@base-ui-components/react/button"
import { Dialog } from "@base-ui-components/react/dialog"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ArrowRightIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import * as Arr from "effect/Array"

import { docsSearchOpenAtom, docsSearchQueryAtom, setDocsSearchOpenAtom } from "../../atoms/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SearchField } from "../primitives/SearchField.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { type DocsDestination, filterDocsDestinations } from "./docsModel.js"

export const DocsSearchTrigger = () => {
  const setOpen = useAtomSet(setDocsSearchOpenAtom)

  return (
    <Button
      aria-label="Search documentation"
      className={`${docsTheme.searchTrigger} w-11 justify-center sm:w-56 sm:justify-start`}
      onClick={() => setOpen(true)}
      type="button"
    >
      <MagnifyingGlassIcon aria-hidden className="h-4 w-4 shrink-0" />
      <SemanticText
        as="span"
        className="hidden min-w-0 flex-1 text-left sm:block"
        role="button-label"
        text="Search docs"
        variant="compact"
      />
      <SemanticText
        as="kbd"
        className="hidden rounded-md border border-stage-200 bg-stage-50 px-1.5 py-0.5 text-ink-500 sm:block"
        role="code-meta"
        text="⌘K"
        variant="compact"
      />
    </Button>
  )
}

export const DocsSearchDialog = ({
  destinations
}: {
  readonly destinations: ReadonlyArray<DocsDestination>
}) => {
  const open = useAtomValue(docsSearchOpenAtom)
  const query = useAtomValue(docsSearchQueryAtom)
  const setOpen = useAtomSet(setDocsSearchOpenAtom)
  const setQuery = useAtomSet(docsSearchQueryAtom)
  const results = filterDocsDestinations(destinations, query)

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className={docsTheme.dialogBackdrop} />
        <Dialog.Viewport className={docsTheme.dialogViewport}>
          <Dialog.Popup className={docsTheme.searchDialog}>
            <Stack className="gap-0">
              <Cluster className="gap-3 border-b border-stage-200/90 p-3 sm:p-4">
                <Layer className="min-w-0 flex-1">
                  <SearchField
                    autoFocus
                    label="Search Theoria documentation"
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search guides and API reference"
                    value={query}
                  />
                </Layer>
                <Dialog.Close aria-label="Close search" className={docsTheme.iconButton}>
                  <XMarkIcon aria-hidden className="h-5 w-5" />
                </Dialog.Close>
              </Cluster>
              <Dialog.Title className="sr-only">Theoria documentation search</Dialog.Title>
              <Dialog.Description className="sr-only">
                Search package guides and the public API reference.
              </Dialog.Description>
              <Stack className="max-h-[26rem] gap-1 overflow-y-auto p-2 sm:p-3">
                {Arr.isNonEmptyReadonlyArray(results)
                  ? Arr.map(results, (destination) => (
                    <InternalLink
                      className="group flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-ink-700 outline-none hover:border-stage-200 hover:bg-stage-50 focus:border-stage-300 focus:bg-stage-50"
                      href={destination.href}
                      key={destination.href}
                      onClick={() => setOpen(false)}
                    >
                      <Stack className="min-w-0 flex-1 gap-0.5">
                        <SemanticText
                          as="span"
                          className="text-ink-900"
                          role="button-label"
                          text={destination.label}
                          variant="compact"
                        />
                        <SemanticText
                          as="span"
                          className="text-ink-500"
                          role="status"
                          text={destination.description}
                          variant="compact"
                          wrapAuthority="native-browser"
                        />
                      </Stack>
                      <ArrowRightIcon
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5"
                      />
                    </InternalLink>
                  ))
                  : (
                    <Stack className="items-center gap-2 px-5 py-10 text-center">
                      <MagnifyingGlassIcon aria-hidden className="h-6 w-6 text-ink-400" />
                      <SemanticText
                        as="p"
                        className="text-ink-900"
                        role="row-label"
                        text="No documentation found"
                        variant="expanded"
                      />
                      <SemanticText
                        as="p"
                        className="text-ink-500"
                        role="status"
                        text="Try a package name, guide, or API term."
                        variant="expanded"
                      />
                    </Stack>
                  )}
              </Stack>
              <Cluster className="justify-end border-t border-stage-200/90 bg-stage-50/65 px-4 py-2.5">
                <SemanticText
                  as="kbd"
                  className="text-ink-500"
                  role="code-meta"
                  text="ESC"
                  variant="compact"
                />
              </Cluster>
            </Stack>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
