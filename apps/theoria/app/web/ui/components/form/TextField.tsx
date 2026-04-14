import type { ComponentPropsWithRef, ReactNode } from "react"

import type { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { InputBehavior } from "../../behavior/InputBehavior.js"
import { fieldControlClassName, type FieldTone } from "../../recipes/field.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { Field } from "./Field.js"

type TextFieldProps = {
  readonly autoComplete?: ComponentPropsWithRef<"input">["autoComplete"]
  readonly className?: string
  readonly defaultValue?: string
  readonly disabled?: boolean
  readonly hint?: ReactNode
  readonly id?: string
  readonly inputClassName?: string
  readonly invalid?: boolean
  readonly label?: ReactNode
  readonly message?: ReactNode
  readonly name?: string
  readonly onValueChange?: ComponentPropsWithRef<typeof InputBehavior>["onValueChange"]
  readonly placeholder?: string
  readonly required?: boolean
  readonly tone?: FieldTone
  readonly type?: ComponentPropsWithRef<"input">["type"]
  readonly validate?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validate"]
  readonly validationMode?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validationMode"]
  readonly value?: string
}

export const TextField = ({
  autoComplete,
  className,
  defaultValue,
  disabled = false,
  hint,
  id,
  inputClassName,
  invalid,
  label,
  message,
  name,
  onValueChange,
  placeholder,
  required,
  tone = "default",
  type = "text",
  validate,
  validationMode,
  value
}: TextFieldProps) => (
  <Field
    {...withClassName(className)}
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
      name={name}
      onValueChange={onValueChange}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
  </Field>
)
