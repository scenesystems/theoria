import type { ComponentPropsWithRef, ReactNode } from "react"

import { TabsBehavior } from "../../behavior/TabsBehavior.js"
import {
  tabsIndicatorClassName,
  tabsListClassName,
  tabsPanelClassName,
  tabsRootClassName,
  tabsTabClassName
} from "../../recipes/tabs.recipe.js"
import { cn, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

type TabsRootProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Root>, "className"> & {
  readonly className?: string
}

type TabsListProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.List>, "className"> & {
  readonly className?: string
}

type TabsIndicatorProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Indicator>, "className"> & {
  readonly className?: string
}

type TabsTabProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Tab>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

type TabsPanelProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Panel>, "className"> & {
  readonly className?: string
}

const Root = ({ className, ...props }: TabsRootProps) => (
  <TabsBehavior.Root {...props} className={cn(tabsRootClassName, className)} />
)

const List = ({ className, ...props }: TabsListProps) => (
  <TabsBehavior.List {...props} className={tabsListClassName(withClassName(className))} />
)

const Indicator = ({ className, ...props }: TabsIndicatorProps) => (
  <TabsBehavior.Indicator {...props} className={tabsIndicatorClassName(withClassName(className))} />
)

const Tab = ({ children, className, ...props }: TabsTabProps) => (
  <TabsBehavior.Tab {...props} className={tabsTabClassName(withClassName(className))}>
    {typeof children === "string" ?
      (
        <SemanticText role="tab" tone="inherit">
          {children}
        </SemanticText>
      ) :
      children}
  </TabsBehavior.Tab>
)

const Panel = ({ className, ...props }: TabsPanelProps) => (
  <TabsBehavior.Panel {...props} className={tabsPanelClassName(withClassName(className))} />
)

export const Tabs = { Root, List, Indicator, Tab, Panel }
