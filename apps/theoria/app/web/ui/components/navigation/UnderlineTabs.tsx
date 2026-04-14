import type { ComponentPropsWithRef, ReactNode } from "react"

import { TabsBehavior } from "../../behavior/TabsBehavior.js"
import {
  underlineTabsListClassName,
  underlineTabsPanelClassName,
  underlineTabsTabClassName
} from "../../recipes/underline-tabs.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

const Root = TabsBehavior.Root

type UnderlineTabsListProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.List>, "className"> & {
  readonly className?: string
}

type UnderlineTabsTabProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Tab>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

type UnderlineTabsPanelProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Panel>, "className"> & {
  readonly className?: string
}

const List = ({ className, ...props }: UnderlineTabsListProps) => (
  <TabsBehavior.List {...props} className={underlineTabsListClassName(withClassName(className))} />
)

const Tab = ({ children, className, ...props }: UnderlineTabsTabProps) => (
  <TabsBehavior.Tab {...props} className={underlineTabsTabClassName(withClassName(className))}>
    {typeof children === "string"
      ? (
        <SemanticText role="tab" tone="inherit">
          {children}
        </SemanticText>
      )
      : children}
  </TabsBehavior.Tab>
)

const Panel = ({ className, ...props }: UnderlineTabsPanelProps) => (
  <TabsBehavior.Panel {...props} className={underlineTabsPanelClassName(withClassName(className))} />
)

export const UnderlineTabs = { Root, List, Tab, Panel }
