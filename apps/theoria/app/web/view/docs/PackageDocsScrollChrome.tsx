import { useAtomValue } from "@effect-atom/atom-react"
import { ArrowUpIcon } from "@heroicons/react/20/solid"

import { packageDocsPageScrollBodyId, packageDocsPageScrolledAtom } from "../../atoms/package-docs-page.js"
import { packageDocsCurrentRouteKeyAtom } from "../../atoms/package-docs.js"
import { Button } from "../../ui/components/action/Button.js"
import { Box } from "../../ui/structure/Box.js"
import { VisuallyHidden } from "../../ui/structure/VisuallyHidden.js"

export const PackageDocsScrollChrome = () => {
  const routeKey = useAtomValue(packageDocsCurrentRouteKeyAtom)
  const scrolled = useAtomValue(packageDocsPageScrolledAtom(routeKey))

  return (
    <>
      {scrolled
        ? (
          <Box className="pointer-events-none fixed right-5 bottom-5 z-40 sm:right-7 sm:bottom-7">
            <Button
              className="pointer-events-auto size-11 rounded-full px-0 py-0 shadow-chip"
              leadingIcon={ArrowUpIcon}
              onClick={() => {
                const body = globalThis.document?.getElementById(packageDocsPageScrollBodyId)

                if (body instanceof HTMLElement) {
                  body.scrollTo({ behavior: "smooth", top: 0 })
                  return
                }

                globalThis.window?.scrollTo({ behavior: "smooth", top: 0 })
              }}
              size="sm"
              tone="neutral"
            >
              <VisuallyHidden>Back to top</VisuallyHidden>
            </Button>
          </Box>
        )
        : null}
    </>
  )
}
