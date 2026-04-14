import type { ReactNode } from "react"

import { withClassName } from "../../structure/Box.js"
import { Divider } from "../../structure/Divider.js"
import { ScrollRegion } from "../../structure/ScrollRegion.js"
import { Stack } from "../../structure/Stack.js"
import { Panel } from "./Panel.js"
import { SectionHeader } from "./SectionHeader.js"

type InspectorProps = {
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly className?: string
  readonly description?: ReactNode
  readonly footer?: ReactNode
  readonly title: ReactNode
}

export const Inspector = ({ actions, children, className, description, footer, title }: InspectorProps) => (
  <Panel {...withClassName(className)} padding="sm" tone="muted">
    <Stack className="h-full" gap="sm">
      <SectionHeader actions={actions} description={description} title={title} />
      <Divider />
      <ScrollRegion className="flex-1 pr-1">{children}</ScrollRegion>
      {footer === undefined ? null : (
        <>
          <Divider />
          {footer}
        </>
      )}
    </Stack>
  </Panel>
)
