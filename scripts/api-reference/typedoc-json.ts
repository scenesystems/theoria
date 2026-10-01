import { Array as Arr, Boolean as Bool, Match, Option, Predicate, Schema, String as Str } from "effect"
import { type JSONOutput } from "typedoc"

// TypeDoc's serialized project is the hand-off format between the conversion
// processes and the generator, and the format of the committed reflection
// files. TypeDoc owns its shape and validates the schema version when it
// revives one, so it is declared rather than re-described here.
const isProjectJson = (value: unknown): value is JSONOutput.ProjectReflection =>
  Match.value(value).pipe(
    Match.when(Predicate.isRecord, (record) =>
      Bool.every(Arr.make(
        Option.liftPredicate(Predicate.isString)(record.variant).pipe(
          Option.exists((variant) => Str.Equivalence(variant, "project"))
        ),
        Predicate.isString(record.schemaVersion),
        Predicate.isString(record.name),
        Predicate.isNumber(record.id)
      ))),
    Match.orElse(() => false)
  )

export type TypeDocProjectJson = JSONOutput.ProjectReflection

export const TypeDocProjectJson: Schema.Schema<TypeDocProjectJson> = Schema.declare(isProjectJson, {
  identifier: "@theoria/scripts/api-reference/TypeDocProjectJson",
  description: "A project reflection serialized by TypeDoc"
})

export const TypeDocProjectJsonText = Schema.parseJson(TypeDocProjectJson)
