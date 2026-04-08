import type { ChangeEventHandler } from "react"

import type { Tone } from "./designSystem.js"
import { Layer } from "./Layout.js"

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
  readonly tone: Tone
  readonly value: string
}) => (
  <Layer>
    <textarea
      className={active
        ? `min-h-28 w-full resize-none rounded-[1.25rem] border px-4 py-3 text-sm leading-relaxed text-ink-900 placeholder:text-ink-400 shadow-chip focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${tone.border} bg-stage-0/94 ${tone.focusRing}`
        : `min-h-28 w-full resize-none rounded-[1.25rem] border border-stage-200/95 bg-stage-0/74 px-4 py-3 text-sm leading-relaxed text-ink-900 placeholder:text-ink-400 shadow-chip focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${tone.focusRing}`}
      disabled={disabled}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      value={value}
    />
  </Layer>
)
