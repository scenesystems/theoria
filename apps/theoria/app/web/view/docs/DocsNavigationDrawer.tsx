import { Dialog } from "@base-ui-components/react/dialog"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { XMarkIcon } from "@heroicons/react/20/solid"

import type { Card } from "../../../contracts/card.js"
import type { DocsSection } from "../../../contracts/docs.js"
import { docsNavigationOpenAtom, setDocsNavigationOpenAtom } from "../../atoms/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Cluster, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import type { DocsDestination } from "./docsModel.js"
import { DocsNavigation } from "./DocsNavigation.js"
import { DocsPackagePicker } from "./DocsPackagePicker.js"

export const DocsNavigationDrawer = ({
  activeCard,
  activeSection,
  cards,
  destinations
}: {
  readonly activeCard: Card
  readonly activeSection: DocsSection
  readonly cards: ReadonlyArray<Card>
  readonly destinations: ReadonlyArray<DocsDestination>
}) => {
  const open = useAtomValue(docsNavigationOpenAtom)
  const setOpen = useAtomSet(setDocsNavigationOpenAtom)

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className={docsTheme.dialogBackdrop} />
        <Dialog.Viewport className={docsTheme.drawerViewport}>
          <Dialog.Popup className={docsTheme.drawer}>
            <Stack className="gap-6 p-5">
              <Cluster className="justify-between gap-4">
                <Dialog.Title>
                  <SemanticText
                    as="span"
                    className="text-ink-900"
                    role="section-title"
                    text="Documentation"
                    variant="expanded"
                  />
                </Dialog.Title>
                <Dialog.Close aria-label="Close navigation" className={docsTheme.iconButton}>
                  <XMarkIcon aria-hidden className="h-5 w-5" />
                </Dialog.Close>
              </Cluster>
              <Dialog.Description className="sr-only">
                Package and section navigation for Theoria documentation.
              </Dialog.Description>
              <DocsPackagePicker activeCard={activeCard} cards={cards} />
              <DocsNavigation
                activeSection={activeSection}
                destinations={destinations}
                label="Mobile documentation"
                onNavigate={() => setOpen(false)}
              />
            </Stack>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
