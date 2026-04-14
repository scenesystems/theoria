import type { ChangeEventHandler, FocusEventHandler, KeyboardEventHandler } from "react"

import { Layer } from "./Layout.js"
import type { Tone } from "./theme/tone.js"

export const SearchField = ({
  active,
  activeDescendant,
  controls,
  disabled,
  expanded,
  onBlur,
  onChange,
  onFocus,
  onKeyDown,
  placeholder,
  tone,
  value
}: {
  readonly active: boolean
  readonly activeDescendant?: string | undefined
  readonly controls?: string | undefined
  readonly disabled: boolean
  readonly expanded?: boolean
  readonly onBlur?: FocusEventHandler<HTMLInputElement>
  readonly onChange: ChangeEventHandler<HTMLInputElement>
  readonly onFocus?: FocusEventHandler<HTMLInputElement>
  readonly onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  readonly placeholder: string
  readonly tone: Tone
  readonly value: string
}) => (
  <Layer>
    <input
      aria-activedescendant={activeDescendant}
      aria-controls={controls}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      className={active || expanded
        ? `h-12 w-full rounded-[1.25rem] border px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-chip transition-[background-color,border-color,box-shadow] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${tone.border} bg-stage-0/94 ${tone.focusRing}`
        : `h-12 w-full rounded-[1.25rem] border border-stage-200/95 bg-stage-0/74 px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-chip focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${tone.focusRing}`}
      autoComplete="off"
      disabled={disabled}
      onBlur={onBlur}
      onChange={onChange}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  </Layer>
)
