import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { Boolean as Bool, Equal, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { classNames } from "./classNames.js"
import {
  pillButtonClassName,
  segmentedControlButtonClassName,
  segmentedControlRailClassName,
  type ToneClasses
} from "./designSystem.js"
import { SemanticText, type SemanticTextElement } from "./SemanticText.js"

/** How a group's options are drawn: as separate pills, or as one segmented control. */
export const ChoiceAppearance = Schema.Literal("pill", "segment")
export type ChoiceAppearance = typeof ChoiceAppearance.Type

const decodeIndex = Schema.decodeUnknownOption(Schema.Number)

/** The group's own classes: a segmented rail sized to its options, or a wrapping row of pills. */
const groupClassName = (
  appearance: ChoiceAppearance,
  optionCount: number,
  className: Option.Option<string>
): string =>
  Match.value(appearance).pipe(
    Match.when("segment", () =>
      classNames(segmentedControlRailClassName(optionCount), Option.getOrElse(className, () => ""))),
    Match.when("pill", () =>
      classNames(
        "flex flex-wrap items-center",
        Option.getOrElse(className, () =>
          "w-full gap-2")
      )),
    Match.exhaustive
  )

const optionClassName = (appearance: ChoiceAppearance, active: boolean, tone: ToneClasses): string =>
  Match.value(appearance).pipe(
    Match.when("segment", () => segmentedControlButtonClassName({ active, tone })),
    Match.when("pill", () => pillButtonClassName({ active, tone })),
    Match.exhaustive
  )

/** A segment's label is a centred paragraph; a pill's, a span in the pill's own line. */
const labelElement = (appearance: ChoiceAppearance): SemanticTextElement =>
  Match.value(appearance).pipe(
    Match.withReturnType<SemanticTextElement>(),
    Match.when("segment", () => "p"),
    Match.when("pill", () => "span"),
    Match.exhaustive
  )

const labelClassName = (appearance: ChoiceAppearance, active: boolean): string =>
  classNames(
    Bool.match(active, { onTrue: () => "text-ink", onFalse: () => "text-ink-secondary" }),
    Match.value(appearance).pipe(
      Match.when("segment", () => "text-center"),
      Match.when("pill", () => ""),
      Match.exhaustive
    )
  )

/**
 * Exactly one choice among a few: a radio group whose items are drawn as pills
 * or as a segmented control. Arrow keys move between options; the selected
 * option is the group's value. `label` names the group for assistive
 * technology (the options name themselves).
 */
export const ChoiceGroup = ({
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
  readonly appearance?: ChoiceAppearance
  readonly className?: string
  readonly disabled: boolean
  readonly label: string
  readonly onSelect: (index: number) => void
  readonly options: ReadonlyArray<{ readonly index: number; readonly label: string }>
  readonly tone: ToneClasses
}) => (
  <RadioGroup
    aria-label={label}
    className={groupClassName(appearance, Arr.length(options), Option.fromNullable(className))}
    disabled={disabled}
    onValueChange={(value) => {
      Option.map(decodeIndex(value), onSelect)
    }}
    value={activeIndex}
  >
    {Arr.map(options, (option) => {
      const active = Equal.equals(option.index, activeIndex)

      return (
        <Radio.Root className={optionClassName(appearance, active, tone)} key={option.index} value={option.index}>
          <SemanticText
            as={labelElement(appearance)}
            className={labelClassName(appearance, active)}
            role="button-label"
            text={option.label}
            variant="expanded"
          />
        </Radio.Root>
      )
    })}
  </RadioGroup>
)
