import { Button } from "@base-ui/react/button"
import * as Arr from "effect/Array"

import type { ChoicePillValue, TypedChoicePillOption } from "./choice-pill-model.js"
import { Cluster, Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import { pillButtonClassName, segmentedControlButtonClassName, segmentedControlRailClassName } from "./theme/button.js"
import { type Tone } from "./theme/tone.js"

type ChoicePillsAppearance = "pill" | "segment"

export const ChoicePills = <Value extends ChoicePillValue>({
  activeValue,
  appearance = "pill",
  className,
  disabled,
  onSelect,
  options,
  tone
}: {
  readonly activeValue: Value
  readonly appearance?: ChoicePillsAppearance
  readonly className?: string
  readonly disabled: boolean
  readonly onSelect: (value: Value) => void
  readonly options: ReadonlyArray<TypedChoicePillOption<Value>>
  readonly tone: Tone
}) => {
  const optionNodes = Arr.map(options, (option) => {
    const active = option.value === activeValue
    const buttonClassName = appearance === "segment"
      ? segmentedControlButtonClassName({ active, tone })
      : pillButtonClassName({ active, tone })

    return (
      <Button
        key={option.value}
        className={buttonClassName}
        disabled={disabled}
        onClick={() => {
          onSelect(option.value)
        }}
        type="button"
      >
        <SemanticText
          as={appearance === "segment" ? "p" : "span"}
          className={`${active ? "text-ink-900" : "text-ink-700"} ${appearance === "segment" ? "text-center" : ""}`}
          role="tab-label"
          text={option.label}
          variant="expanded"
        />
      </Button>
    )
  })

  return appearance === "segment"
    ? <Layer className={`${segmentedControlRailClassName(options.length)} ${className ?? ""}`}>{optionNodes}</Layer>
    : <Cluster className={className ?? "w-full gap-2"}>{optionNodes}</Cluster>
}
