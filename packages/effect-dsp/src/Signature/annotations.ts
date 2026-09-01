/**
 * Annotation primitives for attaching human-readable descriptions to
 * Schema fields. These descriptions appear in derived module instructions
 * and in the {@link FieldInfo} metadata.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { dual } from "effect/Function"

/**
 * Symbol key stored in Schema annotations to carry a field-level
 * description string. Read while constructing Signature field metadata.
 *
 * @see {@link describe} — annotates a Schema with this symbol
 * @see {@link FieldInfo} — consumes the annotation at construction time
 *
 * @since 0.1.0
 * @category annotations
 */
export const FieldDescriptionId: unique symbol = Symbol.for("effect-dsp/FieldDescription")

/**
 * Attaches field text read by {@link make} when it constructs field metadata
 * and default instructions. Supports `describe(schema, text)` and
 * `schema.pipe(describe(text))`; both preserve the schema's decoded, encoded,
 * and context types.
 *
 * @typeParam S - Annotatable schema whose type facets are preserved.
 * @param schema - Schema to annotate in direct-call form.
 * @param description - Text associated with the field.
 * @returns The annotated schema.
 *
 * @see {@link FieldDescriptionId} — the annotation symbol
 * @see {@link Signature} — where descriptions surface in instructions
 *
 * @since 0.1.0
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
