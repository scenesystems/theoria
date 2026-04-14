import type { SelectRootProps } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/16/solid"
import type { ComponentPropsWithRef, ReactNode } from "react"

import type { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { SelectBehavior } from "../../behavior/SelectBehavior.js"
import {
  fieldListboxEmptyClassName,
  fieldListboxIndicatorClassName,
  fieldListboxItemClassName,
  fieldListboxListClassName,
  fieldListboxPopupClassName,
  fieldListboxPositionerClassName,
  fieldSelectTriggerClassName,
  fieldSelectValueClassName
} from "../../recipes/field-listbox.recipe.js"
import { type FieldTone } from "../../recipes/field.recipe.js"
import { Icon } from "../../structure/Icon.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Field } from "./Field.js"

type SelectFieldOption = {
  readonly disabled?: boolean
  readonly label: string
  readonly value: string
}

type SelectFieldProps = {
  readonly className?: string
  readonly defaultOpen?: SelectRootProps<string>["defaultOpen"]
  readonly defaultValue?: SelectRootProps<string>["defaultValue"]
  readonly disabled?: SelectRootProps<string>["disabled"]
  readonly emptyLabel?: ReactNode
  readonly hint?: ReactNode
  readonly invalid?: boolean
  readonly label?: ReactNode
  readonly message?: ReactNode
  readonly modal?: SelectRootProps<string>["modal"]
  readonly name?: SelectRootProps<string>["name"]
  readonly onOpenChange?: SelectRootProps<string>["onOpenChange"]
  readonly onValueChange?: SelectRootProps<string>["onValueChange"]
  readonly open?: SelectRootProps<string>["open"]
  readonly options: ReadonlyArray<SelectFieldOption>
  readonly placeholder?: string
  readonly positionerClassName?: string
  readonly popupClassName?: string
  readonly readOnly?: SelectRootProps<string>["readOnly"]
  readonly required?: boolean
  readonly sideOffset?: ComponentPropsWithRef<typeof SelectBehavior.Positioner>["sideOffset"]
  readonly tone?: FieldTone
  readonly validate?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validate"]
  readonly validationMode?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validationMode"]
  readonly value?: SelectRootProps<string>["value"]
}

export const SelectField = ({
  className,
  defaultOpen,
  defaultValue,
  disabled,
  emptyLabel,
  hint,
  invalid,
  label,
  message,
  modal = false,
  name,
  onOpenChange,
  onValueChange,
  open,
  options,
  placeholder = "Select an option",
  positionerClassName,
  popupClassName,
  readOnly,
  required,
  sideOffset = 8,
  tone = "default",
  validate,
  validationMode,
  value
}: SelectFieldProps) => (
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
    <SelectBehavior.Root
      defaultOpen={defaultOpen}
      defaultValue={defaultValue}
      disabled={disabled}
      items={options}
      modal={modal}
      name={name}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      open={open}
      readOnly={readOnly}
      required={required}
      value={value}
    >
      <SelectBehavior.Trigger
        className={fieldSelectTriggerClassName({ tone, ...(className === undefined ? {} : { className }) })}
      >
        <SelectBehavior.Value className={fieldSelectValueClassName({})} placeholder={placeholder} />
        <Icon className="text-content-muted" size="sm" source={ChevronDownIcon} />
      </SelectBehavior.Trigger>
      <SelectBehavior.Portal>
        <SelectBehavior.Positioner
          className={fieldListboxPositionerClassName(
            positionerClassName === undefined ? {} : { className: positionerClassName }
          )}
          sideOffset={sideOffset}
        >
          <SelectBehavior.Popup
            className={fieldListboxPopupClassName(popupClassName === undefined ? {} : { className: popupClassName })}
          >
            {options.length === 0 ?
              (
                <SemanticText as="div" className={fieldListboxEmptyClassName({})} role="body-sm" tone="inherit">
                  {emptyLabel ?? "No options available."}
                </SemanticText>
              ) :
              (
                <SelectBehavior.List className={fieldListboxListClassName({})}>
                  {options.map((option) => (
                    <SelectBehavior.Item
                      className={fieldListboxItemClassName({})}
                      disabled={option.disabled}
                      key={option.value}
                      value={option.value}
                    >
                      <SemanticText as="span" className="min-w-0 flex-1 truncate" role="body" tone="inherit">
                        {option.label}
                      </SemanticText>
                      <SelectBehavior.ItemIndicator className={fieldListboxIndicatorClassName({})}>
                        <Icon size="sm" source={CheckIcon} />
                      </SelectBehavior.ItemIndicator>
                    </SelectBehavior.Item>
                  ))}
                </SelectBehavior.List>
              )}
          </SelectBehavior.Popup>
        </SelectBehavior.Positioner>
      </SelectBehavior.Portal>
    </SelectBehavior.Root>
  </Field>
)
