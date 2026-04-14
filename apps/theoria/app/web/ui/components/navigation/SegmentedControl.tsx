import type { ComponentPropsWithRef, ReactNode } from "react"

import { TabsBehavior } from "../../behavior/TabsBehavior.js"
import {
  segmentedControlIndicatorClassName,
  segmentedControlListClassName,
  segmentedControlSegmentClassName
} from "../../recipes/segmented-control.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Tabs } from "./Tabs.js"

const Root = Tabs.Root

type SegmentedControlListProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.List>, "className"> & {
  readonly className?: string
}

type SegmentedControlIndicatorProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Indicator>, "className"> & {
  readonly className?: string
}

type SegmentedControlSegmentProps = Omit<ComponentPropsWithRef<typeof TabsBehavior.Tab>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

const List = ({ className, ...props }: SegmentedControlListProps) => (
  <TabsBehavior.List {...props} className={segmentedControlListClassName(withClassName(className))} />
)

const Indicator = ({ className, ...props }: SegmentedControlIndicatorProps) => (
  <TabsBehavior.Indicator {...props} className={segmentedControlIndicatorClassName(withClassName(className))} />
)

const Segment = ({ children, className, ...props }: SegmentedControlSegmentProps) => (
  <TabsBehavior.Tab {...props} className={segmentedControlSegmentClassName(withClassName(className))}>
    {typeof children === "string" ?
      (
        <SemanticText role="tab" tone="inherit">
          {children}
        </SemanticText>
      ) :
      children}
  </TabsBehavior.Tab>
)

const Panel = Tabs.Panel

export const SegmentedControl = { Root, List, Indicator, Segment, Panel }
