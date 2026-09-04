import { Tabs } from "@base-ui/react/tabs"
import { Option } from "effect"
import type { ReactNode } from "react"

import { classNames } from "./classNames.js"
import { Cluster } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const tabClassName =
  "inline-flex min-h-9 items-center rounded-lg border border-transparent bg-transparent px-3.5 py-2 text-ink-700 transition-colors duration-150 ease-out hover:border-stage-300 hover:bg-stage-0/90 hover:text-ink-900 focus-visible:outline-none data-[active]:border-stage-300 data-[active]:bg-stage-0/98 data-[active]:text-ink-900 data-[active]:shadow-chip"

/**
 * A controlled tab group over a closed set of string values. Base UI reports
 * the selected value untyped; `decode` narrows it back to the caller's domain
 * type, so an unknown value is ignored rather than widened. Everything inside
 * is a {@link TabBar} of {@link Tab}s and the {@link TabPanel}s they control.
 */
export const TabGroup = <A extends string>({
  children,
  className = "",
  decode,
  onValueChange,
  value
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly decode: (value: unknown) => Option.Option<A>
  readonly onValueChange: (value: A) => void
  readonly value: A
}) => (
  <Tabs.Root
    className={classNames("min-w-0", className)}
    onValueChange={(next: unknown) => {
      Option.map(decode(next), onValueChange)
    }}
    value={value}
  >
    {children}
  </Tabs.Root>
)

/** The strip of tabs. Base UI owns roving focus and the `tablist` role. */
export const TabBar = ({
  className = "",
  children
}: {
  readonly className?: string
  readonly children: ReactNode
}) => (
  <Tabs.List
    className={classNames("flex gap-1 rounded-lg border border-stage-200/95 bg-stage-100/68 p-1", className)}
  >
    {children}
  </Tabs.List>
)

/** One tab; the active state arrives as `data-active`, so the styles live in one class string. */
export const Tab = ({
  className = "",
  icon,
  label,
  value
}: {
  readonly className?: string
  readonly icon?: ReactNode
  readonly label: string
  readonly value: string
}) => (
  <Tabs.Tab className={classNames(tabClassName, className)} value={value}>
    <Cluster className="gap-1.5 whitespace-nowrap">
      {icon}
      <SemanticText as="span" className="whitespace-nowrap" role="tab-label" text={label} variant="expanded" />
    </Cluster>
  </Tabs.Tab>
)

/** The content a tab controls; `aria-labelledby` and `aria-controls` are wired by the group. */
export const TabPanel = ({
  children,
  className = "",
  value
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly value: string
}) => (
  <Tabs.Panel className={classNames("min-w-0", className)} value={value}>
    {children}
  </Tabs.Panel>
)
