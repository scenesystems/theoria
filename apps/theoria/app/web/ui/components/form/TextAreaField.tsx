import type { ComponentPropsWithRef, ReactNode } from "react"

import { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { fieldTextAreaClassName, type FieldTone } from "../../recipes/field.recipe.js"
import { Field } from "./Field.js"

type TextAreaFieldProps = {
  readonly className?: string
  readonly defaultValue?: ComponentPropsWithRef<"textarea">["defaultValue"]
  readonly disabled?: boolean
  readonly hint?: ReactNode
  readonly id?: string
  readonly invalid?: boolean
  readonly label?: ReactNode
  readonly message?: ReactNode
  readonly name?: string
  readonly onValueChange?: ComponentPropsWithRef<typeof FieldBehavior.Control>["onValueChange"]
  readonly placeholder?: string
  readonly required?: boolean
  readonly rows?: ComponentPropsWithRef<"textarea">["rows"]
  readonly tone?: FieldTone
  readonly validate?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validate"]
  readonly validationMode?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validationMode"]
  readonly value?: string
}

export const TextAreaField = ({
  className,
  defaultValue,
  disabled = false,
  hint,
  id,
  invalid,
  label,
  message,
  name,
  onValueChange,
  placeholder,
  required,
  rows = 5,
  tone = "default",
  validate,
  validationMode,
  value
}: TextAreaFieldProps) => (
  <Field
    {...(className === undefined ? {} : { className })}
    {...(hint === undefined ? {} : { hint })}
    {...(invalid === undefined ? {} : { invalid })}
    {...(label === undefined ? {} : { label })}
    {...(message === undefined ? {} : { message })}
    {...(name === undefined ? {} : { name })}
    tone={tone}
    {...(validate === undefined ? {} : { validate })}
    {...(validationMode === undefined ? {} : { validationMode })}
  >
    <FieldBehavior.Control
      className={fieldTextAreaClassName({ tone })}
      defaultValue={defaultValue}
      disabled={disabled}
      id={id}
      name={name}
      onValueChange={onValueChange}
      placeholder={placeholder}
      render={<textarea rows={rows} />}
      required={required}
      value={value}
    />
  </Field>
)
