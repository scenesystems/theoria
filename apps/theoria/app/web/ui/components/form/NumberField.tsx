import type { ComponentPropsWithRef, ReactNode } from "react"

import type { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { InputBehavior } from "../../behavior/InputBehavior.js"
import { fieldControlClassName, type FieldTone } from "../../recipes/field.recipe.js"
import { Field } from "./Field.js"

type NumberFieldProps = {
  readonly autoComplete?: ComponentPropsWithRef<"input">["autoComplete"]
  readonly className?: string
  readonly defaultValue?: ComponentPropsWithRef<"input">["defaultValue"]
  readonly disabled?: boolean
  readonly hint?: ReactNode
  readonly id?: string
  readonly inputClassName?: string
  readonly invalid?: boolean
  readonly label?: ReactNode
  readonly max?: ComponentPropsWithRef<"input">["max"]
  readonly message?: ReactNode
  readonly min?: ComponentPropsWithRef<"input">["min"]
  readonly name?: string
  readonly onValueChange?: ComponentPropsWithRef<typeof InputBehavior>["onValueChange"]
  readonly placeholder?: string
  readonly required?: boolean
  readonly step?: ComponentPropsWithRef<"input">["step"]
  readonly tone?: FieldTone
  readonly validate?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validate"]
  readonly validationMode?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validationMode"]
  readonly value?: ComponentPropsWithRef<"input">["value"]
}

export const NumberField = ({
  autoComplete,
  className,
  defaultValue,
  disabled = false,
  hint,
  id,
  inputClassName,
  invalid,
  label,
  max,
  message,
  min,
  name,
  onValueChange,
  placeholder,
  required,
  step,
  tone = "default",
  validate,
  validationMode,
  value
}: NumberFieldProps) => (
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
    <InputBehavior
      autoComplete={autoComplete}
      className={fieldControlClassName({
        tone,
        ...(inputClassName === undefined ? {} : { className: inputClassName })
      })}
      defaultValue={defaultValue}
      disabled={disabled}
      id={id}
      max={max}
      min={min}
      name={name}
      onValueChange={onValueChange}
      placeholder={placeholder}
      required={required}
      step={step}
      type="number"
      value={value}
    />
  </Field>
)
