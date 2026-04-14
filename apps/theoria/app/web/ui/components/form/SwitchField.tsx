import type { SwitchRootProps } from "@base-ui/react/switch"
import type { ComponentPropsWithRef, ReactNode } from "react"

import type { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { SwitchBehavior } from "../../behavior/SwitchBehavior.js"
import {
  fieldSwitchRootClassName,
  fieldSwitchStatusClassName,
  fieldSwitchThumbClassName,
  fieldSwitchTrackClassName,
  type FieldTone
} from "../../recipes/field.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Field } from "./Field.js"

type SwitchFieldProps = {
  readonly checked?: SwitchRootProps["checked"]
  readonly checkedLabel?: ReactNode
  readonly className?: string
  readonly defaultChecked?: SwitchRootProps["defaultChecked"]
  readonly disabled?: boolean
  readonly hint?: ReactNode
  readonly id?: string
  readonly invalid?: boolean
  readonly label?: ReactNode
  readonly message?: ReactNode
  readonly name?: string
  readonly onCheckedChange?: SwitchRootProps["onCheckedChange"]
  readonly readOnly?: SwitchRootProps["readOnly"]
  readonly required?: boolean
  readonly tone?: FieldTone
  readonly uncheckedLabel?: ReactNode
  readonly validate?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validate"]
  readonly validationMode?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validationMode"]
  readonly value?: SwitchRootProps["value"]
}

export const SwitchField = ({
  checked,
  checkedLabel = "On",
  className,
  defaultChecked,
  disabled = false,
  hint,
  id,
  invalid,
  label,
  message,
  name,
  onCheckedChange,
  readOnly,
  required,
  tone = "default",
  uncheckedLabel = "Off",
  validate,
  validationMode,
  value
}: SwitchFieldProps) => (
  <Field
    {...(hint === undefined ? {} : { hint })}
    {...(invalid === undefined ? {} : { invalid })}
    {...(label === undefined ? {} : { label })}
    {...(message === undefined ? {} : { message })}
    {...(name === undefined ? {} : { name })}
    tone={tone}
    {...(validate === undefined ? {} : { validate })}
    {...(validationMode === undefined ? {} : { validationMode })}
  >
    <SwitchBehavior.Root
      checked={checked}
      className={fieldSwitchRootClassName({ tone, ...(className === undefined ? {} : { className }) })}
      defaultChecked={defaultChecked}
      disabled={disabled}
      id={id}
      name={name}
      onCheckedChange={onCheckedChange}
      readOnly={readOnly}
      required={required}
      value={value}
    >
      <SemanticText as="span" className={fieldSwitchStatusClassName({ tone })} role="body-sm" tone="inherit">
        <Box as="span" className="group-data-[checked]:hidden">
          {uncheckedLabel}
        </Box>
        <Box as="span" className="hidden group-data-[checked]:inline">
          {checkedLabel}
        </Box>
      </SemanticText>
      <Box as="span" className={fieldSwitchTrackClassName({ tone })}>
        <SwitchBehavior.Thumb className={fieldSwitchThumbClassName({ tone })} />
      </Box>
    </SwitchBehavior.Root>
  </Field>
)
