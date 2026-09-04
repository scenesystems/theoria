import { Predicate, Schema } from "effect"
import { type JSONOutput } from "typedoc"

// TypeDoc's serialized project is the hand-off format between the conversion
// processes and the generator, and the format of the committed reflection
// files. TypeDoc owns its shape and validates the schema version when it
// revives one, so it is declared rather than re-described here.
const isProjectJson = (value: unknown): value is JSONOutput.ProjectReflection =>
  Predicate.isRecord(value)
  && value.variant === "project"
  && Predicate.isString(value.schemaVersion)
  && Predicate.isString(value.name)
  && Predicate.isNumber(value.id)

export type TypeDocProjectJson = JSONOutput.ProjectReflection

export const TypeDocProjectJson: Schema.Schema<TypeDocProjectJson> = Schema.declare(isProjectJson, {
  identifier: "TypeDocProjectJson",
  description: "A project reflection serialized by TypeDoc"
})

export const TypeDocProjectJsonText = Schema.parseJson(TypeDocProjectJson)
