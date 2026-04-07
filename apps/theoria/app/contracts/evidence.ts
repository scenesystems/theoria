import { Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const FiniteNumber = Schema.Number.pipe(Schema.finite())

export const ScalarItem = Schema.Struct({
  _tag: Schema.Literal("Scalar"),
  key: Schema.optional(NonEmptyString),
  label: NonEmptyString,
  value: FiniteNumber,
  unit: Schema.String,
  format: Schema.optional(Schema.Literal("fixed", "integer", "scientific"))
})

export const ComparisonItem = Schema.Struct({
  _tag: Schema.Literal("Comparison"),
  key: Schema.optional(NonEmptyString),
  label: NonEmptyString,
  baseline: FiniteNumber,
  improved: FiniteNumber,
  unit: NonEmptyString,
  direction: Schema.Literal("higher-is-better", "lower-is-better")
})

export const SeriesItem = Schema.Struct({
  _tag: Schema.Literal("Series"),
  key: Schema.optional(NonEmptyString),
  label: NonEmptyString,
  values: Schema.Array(FiniteNumber),
  unit: Schema.String,
  role: NonEmptyString
})

export const TableItem = Schema.Struct({
  _tag: Schema.Literal("Table"),
  key: Schema.optional(NonEmptyString),
  label: NonEmptyString,
  columns: Schema.Array(NonEmptyString),
  rows: Schema.Array(Schema.Array(Schema.String))
})

export const TextItem = Schema.Struct({
  _tag: Schema.Literal("Text"),
  key: Schema.optional(NonEmptyString),
  label: NonEmptyString,
  value: Schema.String
})

export const EvidenceItem = Schema.Union(
  ScalarItem,
  ComparisonItem,
  SeriesItem,
  TableItem,
  TextItem
)

export type EvidenceItem = typeof EvidenceItem.Type

export const EvidenceSection = Schema.Struct({
  key: Schema.optional(NonEmptyString),
  title: NonEmptyString,
  items: Schema.Array(EvidenceItem)
})

export type EvidenceSection = typeof EvidenceSection.Type
