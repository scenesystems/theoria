import type { ReactNode } from "react"

import type { PanelTone } from "../recipes/panel.recipe.js"

import { Panel } from "../components/surface/Panel.js"
import { SectionHeader } from "../components/surface/SectionHeader.js"
import { Box, mergeClassNames, withClassName } from "../structure/Box.js"
import { Stack } from "../structure/Stack.js"

type SectionLayoutProps = {
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly className?: string
  readonly contentClassName?: string
  readonly description?: ReactNode
  readonly eyebrow?: ReactNode
  readonly headerClassName?: string
  readonly meta?: ReactNode
  readonly title?: ReactNode
  readonly tone?: PanelTone
}

const hasHeaderContent = ({
  actions,
  description,
  eyebrow,
  meta,
  title
}: Omit<
  SectionLayoutProps,
  "children" | "className" | "contentClassName" | "headerClassName" | "tone"
>): boolean =>
  title !== undefined ||
  eyebrow !== undefined ||
  description !== undefined ||
  meta !== undefined ||
  actions !== undefined

export const SectionLayout = ({
  actions,
  children,
  className,
  contentClassName,
  description,
  eyebrow,
  headerClassName,
  meta,
  title,
  tone = "default"
}: SectionLayoutProps) => {
  const shouldRenderHeader = hasHeaderContent({ actions, description, eyebrow, meta, title })

  return (
    <Panel as="section" padding="md" tone={tone} {...withClassName(className)}>
      <Stack gap="md">
        {shouldRenderHeader
          ? (
            <SectionHeader
              actions={actions}
              className={mergeClassNames("border-b border-border-muted pb-4", headerClassName)}
              description={description}
              eyebrow={eyebrow}
              meta={meta}
              title={title ?? ""}
            />
          )
          : null}
        <Box {...withClassName(contentClassName)}>{children}</Box>
      </Stack>
    </Panel>
  )
}
