import { Button } from "@base-ui/react/button"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import type {
  EvidencePlaneFilterOption,
  EvidencePlaneOrderOption,
  EvidencePlaneSectionOption
} from "../../../contracts/evidence/plane-presentation.js"

import { Layer, Stack } from "./Layout.js"
import { SelectionCopy, SelectionRail } from "./SelectionLayout.js"
import { SemanticText } from "./SemanticText.js"

export type EvidenceToolbarOption = EvidencePlaneFilterOption | EvidencePlaneOrderOption | EvidencePlaneSectionOption

export function evidenceToolbarOptionValueAt<Value>(
  options: ReadonlyArray<{ readonly index: number; readonly value: Value }>,
  index: number
): Option.Option<Value> {
  return Arr.findFirst(options, (option) => option.index === index).pipe(Option.map((option) => option.value))
}

export function evidenceToolbarOptionAt<OptionValue extends EvidenceToolbarOption>(
  options: ReadonlyArray<OptionValue>,
  index: number
): Option.Option<OptionValue> {
  return Arr.findFirst(options, (option) => option.index === index)
}

const optionGridClassName = ({
  columns,
  scrollable
}: {
  readonly columns: 1 | 2
  readonly scrollable: boolean | undefined
}): string =>
  [
    "grid gap-px overflow-hidden rounded-[1rem] border border-stage-200/72 bg-stage-200/72",
    columns === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
    scrollable === true ? "max-h-64 overflow-y-auto pr-px" : ""
  ].join(" ")

const optionButtonClassName = (active: boolean): string =>
  [
    "group min-w-0 bg-stage-0/90 text-left transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1",
    active ? "bg-stage-50/82" : "hover:bg-stage-50/68"
  ].join(" ")

const accentClassName = (active: boolean): string => active ? "bg-ink-900" : "bg-stage-0/0 group-hover:bg-stage-300/90"

export function EvidenceToolbarControlMatrix<OptionValue extends EvidenceToolbarOption>({
  activeIndex,
  columns,
  onSelect,
  options,
  scrollable
}: {
  readonly activeIndex: number
  readonly columns: 1 | 2
  readonly onSelect: (index: number) => void
  readonly options: ReadonlyArray<OptionValue>
  readonly scrollable?: boolean
}) {
  return (
    <Layer className={optionGridClassName({ columns, scrollable })}>
      {Arr.map(options, (option) => {
        const active = option.index === activeIndex

        return (
          <Button
            className={optionButtonClassName(active)}
            key={option.index}
            onClick={() => {
              onSelect(option.index)
            }}
            type="button"
          >
            <SelectionRail
              accent={<Layer aria-hidden className={`w-1 self-stretch ${accentClassName(active)}`} />}
              className="px-3.5 py-3"
            >
              <SelectionCopy
                title={option.label}
                titleClassName={active ? "max-w-none text-ink-900" : "max-w-none text-ink-700"}
                titleRole="selection-title"
              />
            </SelectionRail>
          </Button>
        )
      })}
    </Layer>
  )
}

export const EvidenceToolbarControlRow = <OptionValue extends EvidenceToolbarOption>({
  activeIndex,
  columns,
  description,
  label,
  onSelect,
  options
}: {
  readonly activeIndex: number
  readonly columns: 1 | 2
  readonly description: string
  readonly label: string
  readonly onSelect: (index: number) => void
  readonly options: ReadonlyArray<OptionValue>
}) => (
  <Stack className="gap-2.5 border-t border-stage-200/62 pt-3.5 first:border-t-0 first:pt-0">
    <Stack className="gap-1">
      <SemanticText as="p" className="text-ink-600" role="row-label" text={label} variant="expanded" />
      <SemanticText as="p" className="text-ink-500" role="code-meta" text={description} variant="expanded" />
    </Stack>
    <EvidenceToolbarControlMatrix activeIndex={activeIndex} columns={columns} onSelect={onSelect} options={options} />
  </Stack>
)
