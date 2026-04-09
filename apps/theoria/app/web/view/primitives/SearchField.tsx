import type { ChangeEventHandler } from "react"

import { Layer } from "./Layout.js"
import type { Tone } from "./theme/tone.js"

export const SearchField = ({
  active,
  disabled,
  onChange,
  placeholder,
  tone,
  value
}: {
  readonly active: boolean
  readonly disabled: boolean
  readonly onChange: ChangeEventHandler<HTMLInputElement>
  readonly placeholder: string
  readonly tone: Tone
  readonly value: string
}) => (
  <Layer>
    <input
      className={active
        ? `h-12 w-full rounded-[1.25rem] border px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-chip focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${tone.border} bg-stage-0/94 ${tone.focusRing}`
        : `h-12 w-full rounded-[1.25rem] border border-stage-200/95 bg-stage-0/74 px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-chip focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${tone.focusRing}`}
      disabled={disabled}
      onChange={onChange}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  </Layer>
)
