import { Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const NonNegativeInteger = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))

export const SurfaceVariant = Schema.Literal("compact", "expanded")

export type SurfaceVariant = typeof SurfaceVariant.Type

export const TabId = Schema.Literal("evidence", "program")

export type TabId = typeof TabId.Type

export const ProgramSourceScope = Schema.Literal("run", "prepared")

export type ProgramSourceScope = typeof ProgramSourceScope.Type

export const ProgramFile = Schema.Struct({
  language: Schema.Literal("ts"),
  entry: NonEmptyString,
  name: NonEmptyString,
  source: NonEmptyString
})

export type ProgramFile = typeof ProgramFile.Type

export const Program = Schema.Struct({
  files: Schema.NonEmptyArray(ProgramFile)
})

export type Program = typeof Program.Type

export const SourceFileTab = Schema.Struct({
  directory: Schema.String,
  entry: NonEmptyString,
  index: NonNegativeInteger,
  name: NonEmptyString
})

export type SourceFileTab = typeof SourceFileTab.Type

export const SourceWorkspaceTab = Schema.Struct({
  label: NonEmptyString,
  scope: ProgramSourceScope
})

export type SourceWorkspaceTab = typeof SourceWorkspaceTab.Type
