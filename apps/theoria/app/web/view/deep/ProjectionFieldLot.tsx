import type { ReactNode } from "react"

import { Layer } from "../primitives/Layout.js"
import { SelectionCopy } from "../primitives/SelectionLayout.js"
import { SemanticText } from "../primitives/SemanticText.js"

const lotShellClassName = ({
  active,
  filled
}: {
  readonly active: boolean
  readonly filled: boolean
}): string =>
  [
    "min-h-14 border-b border-stage-200/72 py-1.5 transition-[background-color,border-color] duration-150 last:border-b-0",
    filled
      ? active
        ? "bg-stage-50/65"
        : "bg-transparent"
      : active
      ? "border-stage-400 bg-stage-50/65"
      : "bg-transparent"
  ].join(" ")

const slotRowClassName = "grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-stretch gap-x-4"

const slotLabelClassName = "inline-flex h-full items-start justify-start pt-3 text-ink-500"

const emptyLaneClassName = (active: boolean): string =>
  [
    "min-h-[4.5rem] flex-1 rounded-[1.15rem] border border-dashed px-4 py-3.5 transition-[border-color,background-color] duration-150",
    active
      ? "border-stage-400 bg-stage-50/60"
      : "border-stage-200/80 bg-stage-50/24"
  ].join(" ")

export const ProjectionFieldLot = ({
  active,
  children,
  emptyLabel = "Open slot",
  index
}: {
  readonly active: boolean
  readonly children: ReactNode | null
  readonly emptyLabel?: string
  readonly index: number
}) => {
  const filled = children !== null

  return (
    <Layer
      className={lotShellClassName({ active, filled })}
      data-projection-lot-index={String(index)}
    >
      <Layer className={slotRowClassName}>
        <Layer as="span" className={slotLabelClassName}>
          <SemanticText
            as="span"
            className="uppercase tracking-[0.18em]"
            role="code-meta"
            text={`P${index + 1}`}
            variant="compact"
          />
        </Layer>
        <Layer className="min-w-0" data-projection-lane-target="true">
          {filled
            ? children
            : (
              <Layer className={emptyLaneClassName(active)}>
                <SelectionCopy
                  detail={active ? "Release to bind here" : "Bind a surface here from the list below"}
                  title={emptyLabel}
                  titleClassName="text-ink-700"
                  titleRole="button-label"
                />
              </Layer>
            )}
        </Layer>
      </Layer>
    </Layer>
  )
}
