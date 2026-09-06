import { Switch } from "@base-ui/react/switch"
import { Option } from "effect"

import { toggleTrackClassName, type ToneClasses } from "./designSystem.js"
import { Rail } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const thumbClassName =
  "block size-5 translate-x-[2px] rounded-full border border-stage-300/80 bg-stage-0 shadow-chip transition-transform duration-150 data-[checked]:translate-x-[21px]"

/**
 * A labelled switch that sizes to its content; the parent decides where it
 * sits. `label` is the visible word; when several switches share it, `subject`
 * names what this one acts on so assistive technology can tell them apart
 * ("Merge" + "Lantern walk" → "Merge Lantern walk").
 */
export const ToggleSwitch = ({
  checked,
  disabled,
  label,
  onToggle,
  subject,
  tone
}: {
  readonly checked: boolean
  readonly disabled: boolean
  readonly label: string
  readonly onToggle: () => void
  readonly subject?: string
  readonly tone: ToneClasses
}) => (
  <Rail className="gap-2.5">
    <SemanticText as="span" className="shrink-0 text-ink-700" role="row-label" text={label} variant="expanded" />
    <Switch.Root
      aria-label={Option.match(Option.fromNullable(subject), {
        onNone: () => label,
        onSome: (name) => `${label} ${name}`
      })}
      checked={checked}
      className={toggleTrackClassName({ checked, tone })}
      disabled={disabled}
      onCheckedChange={onToggle}
    >
      <Switch.Thumb className={thumbClassName} />
    </Switch.Root>
  </Rail>
)
