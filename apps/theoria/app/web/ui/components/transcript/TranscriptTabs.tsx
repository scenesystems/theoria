import type { ComponentPropsWithRef, ReactNode } from "react"

import { TabsBehavior } from "../../behavior/TabsBehavior.js"
import {
  transcriptTabsIndicatorClassName,
  transcriptTabsListClassName,
  transcriptTabsPanelClassName,
  transcriptTabsTabClassName
} from "../../recipes/transcript.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

const Root = TabsBehavior.Root

type TranscriptTabsListProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.List>, "className"> & {
  readonly className?: string
}

type TranscriptTabsIndicatorProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Indicator>, "className"> & {
  readonly className?: string
}

type TranscriptTabsTabProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Tab>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

type TranscriptTabsPanelProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Panel>, "className"> & {
  readonly className?: string
}

const List = ({ className, ...props }: TranscriptTabsListProps) => (
  <TabsBehavior.List {...props} className={transcriptTabsListClassName(withClassName(className))} />
)

const Indicator = ({ className, ...props }: TranscriptTabsIndicatorProps) => (
  <TabsBehavior.Indicator {...props} className={transcriptTabsIndicatorClassName(withClassName(className))} />
)

const Tab = ({ children, className, ...props }: TranscriptTabsTabProps) => (
  <TabsBehavior.Tab {...props} className={transcriptTabsTabClassName(withClassName(className))}>
    {typeof children === "string" ?
      (
        <SemanticText role="pane-meta" tone="inherit">
          {children}
        </SemanticText>
      ) :
      children}
  </TabsBehavior.Tab>
)

const Panel = ({ className, ...props }: TranscriptTabsPanelProps) => (
  <TabsBehavior.Panel {...props} className={transcriptTabsPanelClassName(withClassName(className))} />
)

export const TranscriptTabs = { Root, List, Indicator, Tab, Panel }
