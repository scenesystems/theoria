import { useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { QueueListIcon } from "@heroicons/react/24/outline"

import { PackageDocsPageContent } from "../../../contracts/presentation/package-docs.js"
import { packageDocsLibraryMenuOpenAtom } from "../../atoms/package-docs-page.js"
import { packageDocsCurrentRouteStateAtom } from "../../atoms/package-docs-route.js"
import { packageDocsCurrentRouteKeyAtom, packageDocsSearchPanelOpenAtom } from "../../atoms/package-docs.js"
import { Button } from "../../ui/components/action/Button.js"
import { Dialog } from "../../ui/components/overlay/Dialog.js"
import { WorkspacePane, WorkspacePaneBody, WorkspacePaneHeader } from "../../ui/components/workspace/WorkspacePane.js"

import { PackageDocsCatalogSections } from "./PackageDocsCatalogSections.js"

export const PackageDocsLibraryMenu = () => {
  const routeKey = useAtomValue(packageDocsCurrentRouteKeyAtom)
  const content = PackageDocsPageContent.project(useAtomValue(packageDocsCurrentRouteStateAtom))
  const [open, setOpen] = useAtom(packageDocsLibraryMenuOpenAtom(routeKey))
  const setSearchOpen = useAtomSet(packageDocsSearchPanelOpenAtom(routeKey))
  const hasCatalogSections = content.sections.some((section) => section._tag === "Navigation")

  if (hasCatalogSections === false) {
    return null
  }

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Button
        className="xl:hidden"
        leadingIcon={QueueListIcon}
        onClick={() => {
          setSearchOpen(false)
          setOpen(true)
        }}
        size="sm"
        tone="neutral"
      >
        Library
      </Button>

      <Dialog.Portal keepMounted>
        <Dialog.Backdrop />
        <Dialog.Content className="w-[min(24rem,calc(100vw-1rem))] max-h-[min(82vh,42rem)] gap-0 overflow-hidden p-0">
          <WorkspacePane className="h-full border-none bg-stage-0/96" variant="support">
            <WorkspacePaneHeader
              actions={<Dialog.Close />}
              summary={
                <Dialog.Description>Open a package surface without leaving the docs workspace.</Dialog.Description>
              }
              title={<Dialog.Title>Package library</Dialog.Title>}
              variant="support"
            />
            <WorkspacePaneBody className="bg-stage-0/96" padded={false} scroll>
              <PackageDocsCatalogSections
                onNavigate={() => {
                  setOpen(false)
                }}
                showTitles={false}
              />
            </WorkspacePaneBody>
          </WorkspacePane>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
