import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import { packageDocsLibraryMenuOpenAtom, packageDocsPageScrolledAtom } from "../../atoms/package-docs-page.js"
import { packageDocsCurrentRouteKeyAtom } from "../../atoms/package-docs.js"
import { Box } from "../../ui/structure/Box.js"

import { PackageDocsLibraryMenu } from "./PackageDocsLibraryMenu.js"
import { PackageDocsSearchPanel } from "./PackageDocsSearchPanel.js"

export const PackageDocsHeaderControls = () => {
  const routeKey = useAtomValue(packageDocsCurrentRouteKeyAtom)
  const scrolled = useAtomValue(packageDocsPageScrolledAtom(routeKey))
  const setLibraryMenuOpen = useAtomSet(packageDocsLibraryMenuOpenAtom(routeKey))

  return (
    <Box className="flex w-full items-center gap-2">
      <PackageDocsSearchPanel
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setLibraryMenuOpen(false)
          }
        }}
        triggerClassName={scrolled ? "min-w-0 w-auto flex-1 h-10 px-3" : "min-w-0 w-auto flex-1"}
      />
      <PackageDocsLibraryMenu />
    </Box>
  )
}
