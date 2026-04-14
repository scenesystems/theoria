import type { ComponentPropsWithRef, ReactNode } from "react"

import { TabsBehavior } from "../../behavior/TabsBehavior.js"
import {
  inspectorTabsIndicatorClassName,
  inspectorTabsListClassName,
  inspectorTabsPanelClassName,
  inspectorTabsTabClassName
} from "../../recipes/inspector.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

const Root = TabsBehavior.Root

type InspectorTabsListProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.List>, "className"> & {
  readonly className?: string
}

type InspectorTabsIndicatorProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Indicator>, "className"> & {
  readonly className?: string
}

type InspectorTabsTabProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Tab>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

type InspectorTabsPanelProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Panel>, "className"> & {
  readonly className?: string
}

const List = ({ className, ...props }: InspectorTabsListProps) => (
  <TabsBehavior.List {...props} className={inspectorTabsListClassName(withClassName(className))} />
)

const Indicator = ({ className, ...props }: InspectorTabsIndicatorProps) => (
  <TabsBehavior.Indicator {...props} className={inspectorTabsIndicatorClassName(withClassName(className))} />
)

const Tab = ({ children, className, ...props }: InspectorTabsTabProps) => (
  <TabsBehavior.Tab {...props} className={inspectorTabsTabClassName(withClassName(className))}>
    {typeof children === "string" ?
      (
        <SemanticText role="pane-meta" tone="inherit">
          {children}
        </SemanticText>
      ) :
      children}
  </TabsBehavior.Tab>
)

const Panel = ({ className, ...props }: InspectorTabsPanelProps) => (
  <TabsBehavior.Panel {...props} className={inspectorTabsPanelClassName(withClassName(className))} />
)

export const InspectorTabs = { Root, List, Indicator, Tab, Panel }
