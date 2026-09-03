import type { ChangeEventHandler } from "react"

import type { ToneClasses } from "./designSystem.js"
import { Layer } from "./Layout.js"

/** Grows with its content where the browser supports `field-sizing`; `rows` is the floor everywhere. */
const baseClassName =
  "field-sizing-content min-h-28 w-full resize-none rounded-[1.25rem] border px-4 py-3 text-sm leading-relaxed text-ink-900 shadow-chip placeholder:text-ink-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"

export const TextAreaField = ({
  active,
  disabled,
  onChange,
  placeholder,
  rows,
  tone,
  value
}: {
  readonly active: boolean
  readonly disabled: boolean
  readonly onChange: ChangeEventHandler<HTMLTextAreaElement>
  readonly placeholder: string
  readonly rows: number
  readonly tone: ToneClasses
  readonly value: string
}) => (
  <Layer>
    <textarea
      className={`${baseClassName} ${
        active ? `${tone.border} bg-stage-0/94` : "border-stage-200/95 bg-stage-0/74"
      } ${tone.focusRing}`}
      disabled={disabled}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      value={value}
    />
  </Layer>
)
