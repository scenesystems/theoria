import type { ComboboxRootProps } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/16/solid"
import type { ComponentPropsWithRef, ReactNode } from "react"

import { ComboboxBehavior } from "../../behavior/ComboboxBehavior.js"
import type { FieldBehavior } from "../../behavior/FieldBehavior.js"
import {
  fieldComboboxInputClassName,
  fieldComboboxInputGroupClassName,
  fieldComboboxTriggerClassName,
  fieldListboxEmptyClassName,
  fieldListboxIndicatorClassName,
  fieldListboxItemClassName,
  fieldListboxListClassName,
  fieldListboxPopupClassName,
  fieldListboxPositionerClassName
} from "../../recipes/field-listbox.recipe.js"
import { type FieldTone } from "../../recipes/field.recipe.js"
import { Icon } from "../../structure/Icon.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Field } from "./Field.js"

type ComboboxFieldOption = {
  readonly disabled?: boolean
  readonly label: string
  readonly value: string
}

type ComboboxFieldProps = {
  readonly autoComplete?: ComboboxRootProps<string>["autoComplete"]
  readonly className?: string
  readonly defaultInputValue?: ComboboxRootProps<string>["defaultInputValue"]
  readonly defaultOpen?: ComboboxRootProps<string>["defaultOpen"]
  readonly defaultValue?: ComboboxRootProps<string>["defaultValue"]
  readonly disabled?: ComboboxRootProps<string>["disabled"]
  readonly emptyLabel?: ReactNode
  readonly hint?: ReactNode
  readonly inputValue?: ComboboxRootProps<string>["inputValue"]
  readonly invalid?: boolean
  readonly label?: ReactNode
  readonly message?: ReactNode
  readonly modal?: ComboboxRootProps<string>["modal"]
  readonly name?: ComboboxRootProps<string>["name"]
  readonly onInputValueChange?: ComboboxRootProps<string>["onInputValueChange"]
  readonly onOpenChange?: ComboboxRootProps<string>["onOpenChange"]
  readonly onValueChange?: ComboboxRootProps<string>["onValueChange"]
  readonly open?: ComboboxRootProps<string>["open"]
  readonly options: ReadonlyArray<ComboboxFieldOption>
  readonly placeholder?: string
  readonly positionerClassName?: string
  readonly popupClassName?: string
  readonly readOnly?: ComboboxRootProps<string>["readOnly"]
  readonly required?: boolean
  readonly sideOffset?: ComponentPropsWithRef<typeof ComboboxBehavior.Positioner>["sideOffset"]
  readonly tone?: FieldTone
  readonly validate?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validate"]
  readonly validationMode?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validationMode"]
  readonly value?: ComboboxRootProps<string>["value"]
}

export const ComboboxField = ({
  autoComplete = "list",
  className,
  defaultInputValue,
  defaultOpen,
  defaultValue,
  disabled,
  emptyLabel,
  hint,
  inputValue,
  invalid,
  label,
  message,
  modal = false,
  name,
  onInputValueChange,
  onOpenChange,
  onValueChange,
  open,
  options,
  placeholder = "Search or select",
  positionerClassName,
  popupClassName,
  readOnly,
  required,
  sideOffset = 8,
  tone = "default",
  validate,
  validationMode,
  value
}: ComboboxFieldProps) => (
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
    <ComboboxBehavior.Root
      autoComplete={autoComplete}
      defaultInputValue={defaultInputValue}
      defaultOpen={defaultOpen}
      defaultValue={defaultValue}
      disabled={disabled}
      inputValue={inputValue}
      items={options}
      modal={modal}
      name={name}
      onInputValueChange={onInputValueChange}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      open={open}
      readOnly={readOnly}
      required={required}
      value={value}
    >
      <ComboboxBehavior.InputGroup
        className={fieldComboboxInputGroupClassName({ tone, ...(className === undefined ? {} : { className }) })}
      >
        <ComboboxBehavior.Input className={fieldComboboxInputClassName({})} placeholder={placeholder} />
        <ComboboxBehavior.Trigger className={fieldComboboxTriggerClassName({})}>
          <Icon className="text-inherit" size="sm" source={ChevronDownIcon} />
        </ComboboxBehavior.Trigger>
      </ComboboxBehavior.InputGroup>
      <ComboboxBehavior.Portal>
        <ComboboxBehavior.Positioner
          className={fieldListboxPositionerClassName(
            positionerClassName === undefined ? {} : { className: positionerClassName }
          )}
          sideOffset={sideOffset}
        >
          <ComboboxBehavior.Popup
            className={fieldListboxPopupClassName(popupClassName === undefined ? {} : { className: popupClassName })}
          >
            <ComboboxBehavior.List className={fieldListboxListClassName({})}>
              <ComboboxBehavior.Empty className={fieldListboxEmptyClassName({})}>
                <SemanticText as="span" role="body-sm" tone="inherit">
                  {emptyLabel ?? "No matches found."}
                </SemanticText>
              </ComboboxBehavior.Empty>
              {options.map((option) => (
                <ComboboxBehavior.Item
                  className={fieldListboxItemClassName({})}
                  disabled={option.disabled}
                  key={option.value}
                  value={option.value}
                >
                  <SemanticText as="span" className="min-w-0 flex-1 truncate" role="body" tone="inherit">
                    {option.label}
                  </SemanticText>
                  <ComboboxBehavior.ItemIndicator className={fieldListboxIndicatorClassName({})}>
                    <Icon size="sm" source={CheckIcon} />
                  </ComboboxBehavior.ItemIndicator>
                </ComboboxBehavior.Item>
              ))}
            </ComboboxBehavior.List>
          </ComboboxBehavior.Popup>
        </ComboboxBehavior.Positioner>
      </ComboboxBehavior.Portal>
    </ComboboxBehavior.Root>
  </Field>
)
