import { Tabs } from "@base-ui-components/react/tabs"
import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { TabId } from "../../../contracts/presentation/program.js"
import type { SurfaceVariant, TabId as TabIdentifier } from "../../../contracts/presentation/program.js"

import { SemanticText } from "./SemanticText.js"

const isTabId = Schema.is(TabId)

const tabControlClassName = (variant: SurfaceVariant): string =>
  Match.value(variant).pipe(
    Match.when(
      "expanded",
      () =>
        "inline-flex min-h-8 items-center rounded-lg border px-3.5 py-1.5 transition-colors duration-150 ease-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    ),
    Match.orElse(
      () =>
        "inline-flex min-h-9 items-center rounded-lg border px-3.5 py-2 transition-colors duration-150 ease-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    )
  )

const tabListClassName = (variant: SurfaceVariant): string =>
  Match.value(variant).pipe(
    Match.when(
      "expanded",
      () =>
        "inline-flex w-fit max-w-full flex-nowrap gap-1.5 overflow-x-auto rounded-md border border-stage-200/95 bg-stage-100/68 p-1.5"
    ),
    Match.orElse(
      () => "flex flex-wrap gap-1.5 rounded-md border border-stage-200/95 bg-stage-100/68 p-1.5"
    )
  )

const tabControlStateClassName = ({
  active,
  activeClassName,
  variant,
  inactiveClassName
}: {
  readonly active: boolean
  readonly activeClassName: string
  readonly variant: SurfaceVariant
  readonly inactiveClassName: string
}): string =>
  tabControlClassName(variant)
  + (active ? ` ${activeClassName}` : ` ${inactiveClassName}`)

export const SurfaceTabSelector = ({
  activeClassName,
  ariaLabel,
  inactiveClassName,
  onSelect,
  selected,
  tabs,
  variant
}: {
  readonly activeClassName: string
  readonly ariaLabel: string
  readonly inactiveClassName: string
  readonly onSelect: (tab: TabIdentifier) => void
  readonly selected: TabIdentifier
  readonly tabs: ReadonlyArray<{ readonly id: TabIdentifier; readonly label: string }>
  readonly variant: SurfaceVariant
}) => (
  <Tabs.Root
    onValueChange={(value) => {
      if (isTabId(value)) {
        onSelect(value)
      }
    }}
    value={selected}
  >
    <Tabs.List
      aria-label={ariaLabel}
      className={tabListClassName(variant)}
    >
      {Arr.map(tabs, (tab) => (
        <Tabs.Tab
          className={(state) =>
            tabControlStateClassName({
              active: state.active,
              activeClassName,
              variant,
              inactiveClassName
            })}
          key={tab.id}
          value={tab.id}
        >
          <SemanticText
            as="span"
            className="whitespace-nowrap"
            role="tab-label"
            text={tab.label}
            variant={variant}
          />
        </Tabs.Tab>
      ))}
    </Tabs.List>
  </Tabs.Root>
)
