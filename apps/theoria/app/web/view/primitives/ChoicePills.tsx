import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { classNames } from "./classNames.js"
import {
  pillButtonClassName,
  segmentedControlButtonClassName,
  segmentedControlRailClassName,
  type ToneClasses
} from "./designSystem.js"
import { SemanticText } from "./SemanticText.js"

type ChoicePillsAppearance = "pill" | "segment"

const decodeIndex = Schema.decodeUnknownOption(Schema.Number)

/**
 * Exactly one choice among a few: a radio group whose items are drawn as pills
 * or as a segmented control. Arrow keys move between options; the selected
 * option is the group's value. `label` names the group for assistive
 * technology (the options name themselves).
 */
export const ChoicePills = ({
  activeIndex,
  appearance = "pill",
  className,
  disabled,
  label,
  onSelect,
  options,
  tone
}: {
  readonly activeIndex: number
  readonly appearance?: ChoicePillsAppearance
  readonly className?: string
  readonly disabled: boolean
  readonly label: string
  readonly onSelect: (index: number) => void
  readonly options: ReadonlyArray<{ readonly index: number; readonly label: string }>
  readonly tone: ToneClasses
}) => (
  <RadioGroup
    aria-label={label}
    className={appearance === "segment"
      ? classNames(segmentedControlRailClassName(options.length), className ?? "")
      : classNames("flex flex-wrap items-center", className ?? "w-full gap-2")}
    disabled={disabled}
    onValueChange={(value) => {
      Option.map(decodeIndex(value), onSelect)
    }}
    value={activeIndex}
  >
    {Arr.map(options, (option) => {
      const active = option.index === activeIndex

      return (
        <Radio.Root
          className={appearance === "segment"
            ? segmentedControlButtonClassName({ active, tone })
            : pillButtonClassName({ active, tone })}
          key={option.index}
          value={option.index}
        >
          <SemanticText
            as={appearance === "segment" ? "p" : "span"}
            className={`${active ? "text-ink-900" : "text-ink-700"} ${appearance === "segment" ? "text-center" : ""}`}
            role="tab-label"
            text={option.label}
            variant="expanded"
          />
        </Radio.Root>
      )
    })}
  </RadioGroup>
)
