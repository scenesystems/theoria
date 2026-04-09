import { Schema } from "effect"

export const ChoicePillValue = Schema.Union(Schema.String, Schema.Number)

export type ChoicePillValue = typeof ChoicePillValue.Type

export const ChoicePillOption = Schema.Struct({
  label: Schema.String,
  value: ChoicePillValue
})

export type ChoicePillOption = typeof ChoicePillOption.Type

export type TypedChoicePillOption<Value extends ChoicePillValue> = ChoicePillOption & {
  readonly value: Value
}

export const choicePillOption = <Value extends ChoicePillValue>(
  value: Value,
  label: string
): TypedChoicePillOption<Value> => ({ label, value })
