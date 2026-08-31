import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import type { ChangeEventHandler } from "react"

import { Layer } from "./Layout.js"

export const SearchField = ({
  autoFocus,
  label,
  onChange,
  placeholder,
  value
}: {
  readonly autoFocus?: boolean
  readonly label: string
  readonly onChange: ChangeEventHandler<HTMLInputElement>
  readonly placeholder: string
  readonly value: string
}) => (
  <Layer className="relative">
    <MagnifyingGlassIcon
      aria-hidden
      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500"
    />
    <input
      aria-label={label}
      autoFocus={autoFocus === true}
      className="h-13 w-full rounded-xl border border-stage-200/90 bg-stage-50/72 py-3 pl-12 pr-4 font-body text-[0.95rem] text-ink-900 outline-none placeholder:text-ink-500 focus:border-stage-400 focus:bg-stage-0 focus:ring-2 focus:ring-ink-900/15"
      onChange={onChange}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  </Layer>
)
