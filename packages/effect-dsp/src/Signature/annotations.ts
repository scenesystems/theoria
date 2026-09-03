/**
 * Field descriptions used to derive signature metadata and default instructions.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { dual } from "effect/Function"

/**
 * Stores a field description in a Schema annotation.
 *
 * @remarks
 * {@link make} reads this annotation from each input and output field. Consumers
 * that inspect annotations directly can use the same symbol as a lookup key.
 *
 * @since 0.1.0
 * @category annotations
 */
export const FieldDescriptionId: unique symbol = Symbol.for("effect-dsp/FieldDescription")

/**
 * Attaches descriptive text to a signature field schema.
 *
 * @remarks
 * {@link make} copies the text into {@link FieldInfo} and includes it in the
 * derived instructions. Direct and pipeable calls preserve every schema facet.
 *
 * @param schema - Field schema in the direct-call form.
 * @param description - Caller-facing field meaning included in generated instructions.
 * @returns A copy of the schema with the description annotation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const describe: {
  (description: string): <S extends Schema.Annotable.All>(schema: S) => Schema.Annotable.Self<S>
  /** @typeParam S - Schema whose decoded, encoded, and context types are retained. */
  <S extends Schema.Annotable.All>(schema: S, description: string): Schema.Annotable.Self<S>
} = dual(
  2,
  <S extends Schema.Annotable.All>(schema: S, description: string): Schema.Annotable.Self<S> =>
    Schema.annotations(schema, { [FieldDescriptionId]: description })
)
