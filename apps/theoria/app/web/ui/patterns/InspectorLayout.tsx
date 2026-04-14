import type { ReactNode } from "react"

import { TwoPaneLayout } from "./TwoPaneLayout.js"

type InspectorLayoutProps = {
  readonly className?: string
  readonly inspector: ReactNode
  readonly main: ReactNode
}

export const InspectorLayout = ({ className, inspector, main }: InspectorLayoutProps) => (
  <TwoPaneLayout
    {...(className === undefined ? {} : { className })}
    primary={main}
    ratio="inspector"
    secondary={inspector}
  />
)
