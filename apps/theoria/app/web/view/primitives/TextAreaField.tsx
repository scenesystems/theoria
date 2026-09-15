import { Field } from "@base-ui/react/field"
import { Boolean as Bool } from "effect"
import type { ReactNode } from "react"

import { classNames } from "./classNames.js"
import { focusClassName, surfaceClassName, type ToneClasses } from "./designSystem.js"

/** Grows with its content where the browser supports `field-sizing`; `rows` is the floor everywhere. */
const controlClassName =
  `field-sizing-content min-h-28 w-full resize-none border px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-tertiary ${focusClassName} ${
    surfaceClassName("instrument")
  }`

/**
 * A labelled field. Base UI wires `id`/`htmlFor`/`aria-describedby` between
 * the {@link FieldLabel}, {@link FieldDescription} and the control, so the
 * caller lays the parts out however the composition needs. `dirty` is the
 * field's state as the caller's own model knows it — the value no longer
 * matches what the field started from — handed to Base UI, which puts it on
 * every part as `data-dirty` and gives it to their `className` functions.
 */
export const FieldGroup = ({
  children,
  className = "",
  dirty,
  disabled
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly dirty: boolean
  readonly disabled: boolean
}) => (
  <Field.Root className={classNames("flex min-w-0 flex-col", className)} dirty={dirty} disabled={disabled}>
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
 * caller applies its own limits. A dirty field ({@link FieldGroup} `dirty`)
 * shows the tone's border in place of the rule.
 */
export const TextAreaField = ({
  onValueChange,
  placeholder,
  rows,
  tone,
  value
}: {
  readonly onValueChange: (value: string) => void
  readonly placeholder: string
  readonly rows: number
  readonly tone: ToneClasses
  readonly value: string
}) => (
  <Field.Control
    className={(state) =>
      `${controlClassName} ${Bool.match(state.dirty, { onTrue: () => tone.border, onFalse: () => "border-hairline" })}`}
    onValueChange={onValueChange}
    placeholder={placeholder}
    render={<textarea rows={rows} />}
    value={value}
  />
)
