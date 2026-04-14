import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../structure/Box.js"
import { Cluster } from "../structure/Cluster.js"

type SiteHeaderProps = {
  readonly actions?: ReactNode
  readonly brand: ReactNode
  readonly center?: ReactNode
  readonly className?: string
  readonly density?: "default" | "compact"
  readonly sticky?: boolean
  readonly supporting?: ReactNode
}

export const SiteHeader = ({
  actions,
  brand,
  center,
  className,
  density = "default",
  sticky = false,
  supporting
}: SiteHeaderProps) => (
  <Box
    as="header"
    className={mergeClassNames(
      "relative z-20 border-b border-stage-200/90 bg-stage-0/88 backdrop-blur-xl",
      sticky ? "sticky top-0 z-40" : undefined,
      className
    )}
  >
    <Box
      className={mergeClassNames(
        "w-full px-4 sm:px-6 lg:px-8 xl:px-10",
        density === "compact" ? "py-1.5 sm:py-2" : "py-3"
      )}
    >
      <Box
        className={mergeClassNames(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]",
          density === "compact" ? "min-h-11" : "min-h-14"
        )}
      >
        <Box className="min-w-0">{brand}</Box>
        <Cluster className="justify-self-end" gap="sm">
          {actions}
        </Cluster>
        {center === undefined
          ? null
          : (
            <Box className="col-span-full min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:w-full lg:max-w-[32rem] lg:justify-self-center">
              {center}
            </Box>
          )}
        {supporting === undefined
          ? null
          : (
            <Box className="col-span-full border-t border-stage-200/80 pt-3">
              {supporting}
            </Box>
          )}
      </Box>
    </Box>
  </Box>
)
