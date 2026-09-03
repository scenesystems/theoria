import { Dialog } from "@base-ui/react/dialog"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { XMarkIcon } from "@heroicons/react/20/solid"

import type { DocsManifest, DocsPackageSummary } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsNavigationOpenAtom, setDocsNavigationOpenAtom } from "../../atoms/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Cluster, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsNavigation } from "./DocsNavigation.js"
import { DocsPackagePicker } from "./DocsPackagePicker.js"

export const DocsNavigationDrawer = ({
  docsPackage,
  manifest,
  route
}: {
  readonly docsPackage: DocsPackageSummary
  readonly manifest: DocsManifest
  readonly route: DocsRoute
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
                <Dialog.Title
                  render={<SemanticText as="h2" className="text-ink-900" role="section-title" text="Menu" />}
                />
                <Dialog.Close aria-label="Close navigation" className={docsTheme.iconButton}>
                  <XMarkIcon aria-hidden className="h-5 w-5" />
                </Dialog.Close>
              </Cluster>
              <Dialog.Description
                render={
                  <SemanticText
                    as="p"
                    className="sr-only"
                    role="status"
                    text="Select a package, guide, or API module."
                  />
                }
              />
              <DocsPackagePicker
                activePackage={docsPackage}
                onNavigate={() => setOpen(false)}
                packages={manifest.packages}
              />
              <DocsNavigation
                docsPackage={docsPackage}
                onNavigate={() => setOpen(false)}
                route={route}
              />
            </Stack>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
