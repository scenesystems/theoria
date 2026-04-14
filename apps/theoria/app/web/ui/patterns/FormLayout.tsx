import type { ElementType, ReactNode } from "react"

import { Box } from "../structure/Box.js"
import { Stack } from "../structure/Stack.js"
import { SectionLayout } from "./SectionLayout.js"

type FormLayoutProps = {
  readonly actions?: ReactNode
  readonly as?: ElementType
  readonly children: ReactNode
  readonly className?: string
  readonly description?: ReactNode
  readonly title?: ReactNode
}

export const FormLayout = ({
  actions,
  as,
  children,
  className,
  description,
  title
}: FormLayoutProps) => (
  <SectionLayout {...(className === undefined ? {} : { className })} description={description} title={title}>
    <Stack as={as ?? "div"} gap="lg">
      <Stack gap="md">{children}</Stack>
      {actions === undefined ? null : <Box className="border-t border-border-muted pt-4">{actions}</Box>}
    </Stack>
  </SectionLayout>
)
