import { Button } from "@base-ui-components/react/button"
import * as Arr from "effect/Array"

import {
  pillButtonClassName,
  segmentedControlButtonClassName,
  segmentedControlRailClassName,
  type ToneClasses
} from "./designSystem.js"
import { Cluster, Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type ChoicePillsAppearance = "pill" | "segment"

export const ChoicePills = ({
  activeIndex,
  appearance = "pill",
  className,
  disabled,
  onSelect,
  options,
  tone
}: {
  readonly activeIndex: number
  readonly appearance?: ChoicePillsAppearance
  readonly className?: string
  readonly disabled: boolean
  readonly onSelect: (index: number) => void
  readonly options: ReadonlyArray<{ readonly index: number; readonly label: string }>
  readonly tone: ToneClasses
}) => {
  const optionNodes = Arr.map(options, (option) => {
    const active = option.index === activeIndex
    const buttonClassName = appearance === "segment"
      ? segmentedControlButtonClassName({ active, tone })
      : pillButtonClassName({ active, tone })

    return (
      <Button
        key={option.index}
        className={buttonClassName}
        disabled={disabled}
        onClick={() => {
          onSelect(option.index)
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
