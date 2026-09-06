import { Field } from "@base-ui/react/field"
import type { ReactNode } from "react"

import { classNames } from "./classNames.js"
import type { ToneClasses } from "./designSystem.js"

/** Grows with its content where the browser supports `field-sizing`; `rows` is the floor everywhere. */
const controlClassName =
  "field-sizing-content min-h-28 w-full resize-none rounded-[1.25rem] border px-4 py-3 text-sm leading-relaxed text-ink-900 shadow-chip placeholder:text-ink-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"

/**
 * A labelled field. Base UI wires `id`/`htmlFor`/`aria-describedby` between
 * the {@link FieldLabel}, {@link FieldDescription} and the control, so the
 * caller lays the parts out however the composition needs.
 */
export const FieldGroup = ({
  children,
  className = "",
  disabled
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly disabled: boolean
}) => (
  <Field.Root className={classNames("flex min-w-0 flex-col", className)} disabled={disabled}>
    {children}
  </Field.Root>
)

export const FieldLabel = (
  { children, className = "" }: { readonly children: ReactNode; readonly className?: string }
) => <Field.Label className={classNames("min-w-0", className)}>{children}</Field.Label>

export const FieldDescription = (
  { children, className = "" }: { readonly children: ReactNode; readonly className?: string }
) => <Field.Description className={classNames("min-w-0", className)}>{children}</Field.Description>

/**
 * The field's multi-line control. `onValueChange` receives the new text; the
 * caller applies its own limits. The active state shows when the value no
 * longer matches what the field started from.
 */
export const TextAreaField = ({
  active,
  onValueChange,
  placeholder,
  rows,
  tone,
  value
}: {
  readonly active: boolean
  readonly onValueChange: (value: string) => void
  readonly placeholder: string
  readonly rows: number
  readonly tone: ToneClasses
  readonly value: string
}) => (
  <Field.Control
    className={`${controlClassName} ${
      active ? `${tone.border} bg-stage-0/94` : "border-stage-200/95 bg-stage-0/74"
    } ${tone.focusRing}`}
    onValueChange={onValueChange}
    placeholder={placeholder}
    render={<textarea rows={rows} />}
    value={value}
  />
)
