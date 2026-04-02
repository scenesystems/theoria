import { Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const EvidenceRow = Schema.Struct({
  label: NonEmptyString,
  value: NonEmptyString
})

export type EvidenceRow = typeof EvidenceRow.Type
