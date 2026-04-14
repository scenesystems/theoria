import type { ReactNode } from "react"

import { Layer, Stack } from "./Layout.js"

export const SurfaceViewport = ({
  children,
  className
}: {
  readonly children: ReactNode
  readonly className?: string
}) => (
  <Stack className={`w-full gap-0 ${className ?? ""}`.trim()}>
    {children}
    <Layer aria-hidden className="h-6 shrink-0" />
  </Stack>
)
