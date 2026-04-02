import type { ReactNode } from "react"

import type { EvidenceSpan } from "../data/evidence-layout.js"
import { spanClassName } from "../data/evidence-layout.js"

import { Layer } from "./Layout.js"

export const EvidenceGrid = ({
  children,
  className
}: {
  readonly children: ReactNode
  readonly className?: string
}) => (
  <Layer
    className={`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4${
      className !== undefined ? ` ${className}` : ""
    }`}
  >
    {children}
  </Layer>
)

export const EvidenceGridItem = ({
  children,
  span
}: {
  readonly children: ReactNode
  readonly span: EvidenceSpan
}) => <Layer className={spanClassName(span)}>{children}</Layer>
