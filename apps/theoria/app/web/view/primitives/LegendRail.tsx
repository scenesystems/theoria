import * as Arr from "effect/Array"

import { Layer } from "./Layout.js"
import { LegendItem } from "./LegendItem.js"
import type { Legend } from "./theme/evidence.js"

type LegendEntry = {
  readonly legend: Legend
  readonly label: string
  readonly shape: "circle" | "square" | "diamond"
  readonly value?: string
}

const railColumnsClassName = (count: number): string =>
  count <= 2
    ? "grid-cols-1 md:grid-cols-2"
    : count === 3
    ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
    : "grid-cols-1 md:grid-cols-2 2xl:grid-cols-4"

export const LegendRail = ({
  items
}: {
  readonly items: ReadonlyArray<LegendEntry>
}) => (
  <Layer className="overflow-hidden border-y border-stage-200/72 bg-transparent">
    <Layer
      as="dl"
      className={`-mb-px -mr-px grid auto-rows-fr ${railColumnsClassName(items.length)}`}
    >
      {Arr.map(items, (item) => (
        <Layer
          className="flex min-w-0 items-center border-r border-b border-stage-200/72 px-3 py-2 sm:px-4"
          key={item.label}
        >
          {item.value === undefined
            ? (
              <LegendItem
                legend={item.legend}
                label={item.label}
                shape={item.shape}
                variant="rail"
              />
            )
            : (
              <LegendItem
                legend={item.legend}
                label={item.label}
                shape={item.shape}
                value={item.value}
                variant="rail"
              />
            )}
        </Layer>
      ))}
    </Layer>
  </Layer>
)
