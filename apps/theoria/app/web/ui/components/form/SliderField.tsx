import type { SliderRootProps } from "@base-ui/react/slider"
import type { ComponentPropsWithRef, ReactNode } from "react"

import type { FieldBehavior } from "../../behavior/FieldBehavior.js"
import { SliderBehavior } from "../../behavior/SliderBehavior.js"
import {
  fieldSliderControlClassName,
  fieldSliderIndicatorClassName,
  fieldSliderRootClassName,
  fieldSliderThumbClassName,
  fieldSliderTrackClassName,
  fieldSliderValueClassName,
  type FieldTone
} from "../../recipes/field.recipe.js"
import { Cluster } from "../../structure/Cluster.js"
import { Field } from "./Field.js"

type SliderFieldProps = {
  readonly className?: string
  readonly defaultValue?: SliderRootProps<number>["defaultValue"]
  readonly disabled?: SliderRootProps<number>["disabled"]
  readonly format?: SliderRootProps<number>["format"]
  readonly hint?: ReactNode
  readonly invalid?: boolean
  readonly label?: ReactNode
  readonly largeStep?: SliderRootProps<number>["largeStep"]
  readonly locale?: SliderRootProps<number>["locale"]
  readonly max?: SliderRootProps<number>["max"]
  readonly message?: ReactNode
  readonly min?: SliderRootProps<number>["min"]
  readonly name?: SliderRootProps<number>["name"]
  readonly onValueChange?: SliderRootProps<number>["onValueChange"]
  readonly onValueCommitted?: SliderRootProps<number>["onValueCommitted"]
  readonly required?: boolean
  readonly step?: SliderRootProps<number>["step"]
  readonly thumbAlignment?: SliderRootProps<number>["thumbAlignment"]
  readonly tone?: FieldTone
  readonly validate?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validate"]
  readonly validationMode?: ComponentPropsWithRef<typeof FieldBehavior.Root>["validationMode"]
  readonly value?: SliderRootProps<number>["value"]
}

export const SliderField = ({
  className,
  defaultValue,
  disabled,
  format,
  hint,
  invalid,
  label,
  largeStep,
  locale,
  max,
  message,
  min,
  name,
  onValueChange,
  onValueCommitted,
  required,
  step,
  thumbAlignment,
  tone = "default",
  validate,
  validationMode,
  value
}: SliderFieldProps) => (
  <Field
    {...(hint === undefined ? {} : { hint })}
    {...(invalid === undefined ? {} : { invalid })}
    {...(label === undefined ? {} : { label })}
    {...(message === undefined ? {} : { message })}
    {...(name === undefined ? {} : { name })}
    {...(required === undefined ? {} : { required })}
    tone={tone}
    {...(validate === undefined ? {} : { validate })}
    {...(validationMode === undefined ? {} : { validationMode })}
  >
    <SliderBehavior.Root
      className={fieldSliderRootClassName({ tone, ...(className === undefined ? {} : { className }) })}
      defaultValue={defaultValue}
      disabled={disabled}
      format={format}
      largeStep={largeStep}
      locale={locale}
      max={max}
      min={min}
      name={name}
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      step={step}
      thumbAlignment={thumbAlignment}
      value={value}
    >
      <Cluster gap="sm" justify="between">
        <SliderBehavior.Value className={fieldSliderValueClassName({ tone })} />
      </Cluster>
      <SliderBehavior.Control className={fieldSliderControlClassName({})}>
        <SliderBehavior.Track className={fieldSliderTrackClassName({})}>
          <SliderBehavior.Indicator className={fieldSliderIndicatorClassName({ tone })} />
        </SliderBehavior.Track>
        <SliderBehavior.Thumb className={fieldSliderThumbClassName({ tone })} />
      </SliderBehavior.Control>
    </SliderBehavior.Root>
  </Field>
)
