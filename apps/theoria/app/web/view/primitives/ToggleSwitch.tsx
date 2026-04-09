import { Button } from "@base-ui-components/react/button"

import { Cluster, Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import { toggleTrackClassName } from "./theme/button.js"
import { type Tone } from "./theme/tone.js"

export const ToggleSwitch = ({
  checked,
  description,
  disabled,
  label,
  onToggle,
  tone
}: {
  readonly checked: boolean
  readonly description?: string
  readonly disabled: boolean
  readonly label: string
  readonly onToggle: () => void
  readonly tone: Tone
}) => (
  <Cluster className="w-full flex-nowrap items-center justify-between gap-3">
    <Cluster className="min-w-0 flex-1 flex-nowrap items-center gap-2">
      <SemanticText
        as="dt"
        className="shrink-0 text-ink-700"
        role="row-label"
        text={label}
        variant="expanded"
      />
      {description === undefined
        ? null
        : (
          <SemanticText
            as="p"
            className="min-w-0 text-ink-700/78"
            role="code-meta"
            text={description}
            variant="expanded"
          />
        )}
    </Cluster>
    <Button
      aria-checked={checked}
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
  </Cluster>
)
