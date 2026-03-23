/**
 * Annotation primitives for attaching human-readable descriptions to
 * Schema fields. These descriptions appear in derived module instructions
 * and in the {@link FieldInfo} metadata.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"
import { dual } from "effect/Function"

/**
 * Symbol key stored in Schema annotations to carry a field-level
 * description string. Read by {@link fieldsToInfoArray} during
 * Signature construction.
 *
 * @see {@link describe} — annotates a Schema with this symbol
 * @see {@link FieldInfo} — consumes the annotation at construction time
 *
 * @since 0.0.0
 * @category annotations
 */
export const FieldDescriptionId: unique symbol = Symbol.for("effect-dsp/FieldDescription")

/**
 * Attach a human-readable description to a Schema field. The description
 * is embedded as an annotation under {@link FieldDescriptionId} and
 * appears in the derived module instructions and {@link FieldInfo} metadata.
 * Supports both pipeable and direct call styles.
 *
 * @see {@link FieldDescriptionId} — the annotation symbol
 * @see {@link Signature} — where descriptions surface in instructions
 *
 * @since 0.0.0
 * @category constructors
 */
export const describe: {
  (description: string): <S extends Schema.Annotable.All>(schema: S) => Schema.Annotable.Self<S>
  <S extends Schema.Annotable.All>(schema: S, description: string): Schema.Annotable.Self<S>
} = dual(
  2,
  <S extends Schema.Annotable.All>(schema: S, description: string): Schema.Annotable.Self<S> =>
    Schema.annotations(schema, { [FieldDescriptionId]: description })
)
