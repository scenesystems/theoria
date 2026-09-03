import { Button } from "@base-ui-components/react/button"

import { toggleTrackClassName, type ToneClasses } from "./designSystem.js"
import { Layer, Rail } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

/** A labelled switch that sizes to its content; the parent decides where it sits. */
export const ToggleSwitch = ({
  checked,
  disabled,
  label,
  onToggle,
  tone
}: {
  readonly checked: boolean
  readonly disabled: boolean
  readonly label: string
  readonly onToggle: () => void
  readonly tone: ToneClasses
}) => (
  <Rail className="gap-2.5">
    <SemanticText as="span" className="shrink-0 text-ink-700" role="row-label" text={label} variant="expanded" />
    <Button
      aria-checked={checked}
      aria-label={label}
      className={toggleTrackClassName({ checked, tone })}
      disabled={disabled}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <Layer
        aria-hidden
        as="span"
        className={checked
          ? "block size-5 translate-x-[21px] rounded-full border border-stage-300/80 bg-stage-0 shadow-chip transition-transform duration-150"
          : "block size-5 translate-x-[2px] rounded-full border border-stage-300/80 bg-stage-0 shadow-chip transition-transform duration-150"}
      />
    </Button>
  </Rail>
)
