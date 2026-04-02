import type { ReactNode } from "react"

import { Layer, Stack } from "./Layout.js"

export const SurfaceViewport = ({
  children,
  className
}: {
  readonly children: ReactNode
  readonly className?: string
}) => (
  <Stack className={`mx-auto w-full max-w-6xl gap-4 xl:px-4 2xl:px-6 ${className ?? ""}`.trim()}>
    {children}
    <Layer aria-hidden className="h-8 shrink-0 sm:h-10" />
  </Stack>
)
