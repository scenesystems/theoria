import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import type { ComponentPropsWithRef, ReactNode } from "react"

import type { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { InputBehavior } from "../../behavior/InputBehavior.js"
import { fieldControlClassName } from "../../recipes/field.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { Icon } from "../../structure/Icon.js"
import { Field } from "./Field.js"

type SearchFieldProps = {
  readonly active?: boolean
  readonly activeDescendant?: string | undefined
  readonly autoCapitalize?: string
  readonly autoComplete?: string
  readonly autoCorrect?: string
  readonly autoFocus?: boolean
  readonly className?: string
  readonly controls?: string | undefined
  readonly defaultValue?: string
  readonly disabled?: boolean
  readonly expanded?: boolean | undefined
  readonly hint?: ReactNode
  readonly id?: string
  readonly inputClassName?: string
  readonly invalid?: boolean
  readonly label?: ReactNode
  readonly message?: ReactNode
  readonly name?: string
  readonly onBlur?: ComponentPropsWithRef<typeof InputBehavior>["onBlur"]
  readonly onChange?: ComponentPropsWithRef<typeof InputBehavior>["onChange"]
  readonly onFocus?: ComponentPropsWithRef<typeof InputBehavior>["onFocus"]
  readonly onKeyDown?: ComponentPropsWithRef<typeof InputBehavior>["onKeyDown"]
  readonly onValueChange?: ComponentPropsWithRef<typeof InputBehavior>["onValueChange"]
  readonly placeholder?: string
  readonly required?: boolean
  readonly spellCheck?: boolean
  readonly type?: "search" | "text"
  readonly validate?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validate"]
  readonly validationMode?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validationMode"]
  readonly value?: string
}

export const SearchField = ({
  active = false,
  activeDescendant,
  autoCapitalize,
  autoComplete,
  autoCorrect,
  autoFocus,
  className,
  controls,
  defaultValue,
  disabled = false,
  expanded,
  hint,
  id,
  inputClassName,
  invalid,
  label,
  message,
  name,
  onBlur,
  onChange,
  onFocus,
  onKeyDown,
  onValueChange,
  placeholder = "Search",
  required,
  spellCheck,
  type = "search",
  validate,
  validationMode,
  value
}: SearchFieldProps) => (
  <Field
    {...withClassName(className)}
    {...(hint === undefined ? {} : { hint })}
    {...(invalid === undefined ? {} : { invalid })}
    {...(label === undefined ? {} : { label })}
    {...(message === undefined ? {} : { message })}
    {...(name === undefined ? {} : { name })}
    tone="accent"
    {...(validate === undefined ? {} : { validate })}
    {...(validationMode === undefined ? {} : { validationMode })}
  >
    <Box className="relative">
      <Box className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-content-subtle">
        <Icon size="sm" source={MagnifyingGlassIcon} />
      </Box>
      <InputBehavior
        aria-activedescendant={activeDescendant}
        aria-controls={controls}
        aria-expanded={expanded}
        aria-haspopup={controls === undefined ? undefined : "dialog"}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        className={fieldControlClassName({
          tone: "accent",
          className: [
            "pl-10",
            active || expanded
              ? "border-accent-solid bg-surface-panel shadow-ui-chip"
              : undefined,
            inputClassName
          ].filter(Boolean).join(" ")
        })}
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onValueChange={onValueChange}
        placeholder={placeholder}
        required={required}
        spellCheck={spellCheck}
        type={type}
        value={value}
      />
    </Box>
  </Field>
)
