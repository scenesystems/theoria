import { Button } from "@base-ui-components/react/button"
import * as Arr from "effect/Array"

import { pillButtonClassName, type ToneClasses } from "./designSystem.js"
import { Cluster } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

export const ChoicePills = ({
  activeIndex,
  className,
  disabled,
  onSelect,
  options,
  tone
}: {
  readonly activeIndex: number
  readonly className?: string
  readonly disabled: boolean
  readonly onSelect: (index: number) => void
  readonly options: ReadonlyArray<{ readonly index: number; readonly label: string }>
  readonly tone: ToneClasses
}) => (
  <Cluster className={className ?? "w-full gap-2"}>
    {Arr.map(options, (option) => {
      const active = option.index === activeIndex
      return (
        <Button
          key={option.index}
          className={pillButtonClassName({ active, tone })}
          disabled={disabled}
          onClick={() => {
            onSelect(option.index)
          }}
          type="button"
        >
          <SemanticText
            as="span"
            className={active ? "text-ink-900" : "text-ink-700"}
            role="tab-label"
            text={option.label}
            variant="expanded"
          />
        </Button>
      )
    })}
  </Cluster>
)
