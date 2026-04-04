/**
 * Core Signature model — the typed I/O specification that every module
 * is built from.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

/**
 * Metadata extracted from a single `Schema.Struct` property signature —
 * field name, optional human-readable description (set via
 * {@link describe}), and whether the field is optional. The
 * {@link Signature} constructor populates these automatically from
 * the input and output Schema fields.
 *
 * @see {@link describe} — annotates a Schema field with a description
 * @see {@link Signature} — carries an array of FieldInfo
 *
 * @since 0.1.0
 * @category models
 */
export class FieldInfo extends Schema.Class<FieldInfo>("FieldInfo")({
  name: Schema.String,
  description: Schema.OptionFromSelf(Schema.String),
  isOptional: Schema.Boolean
}) {}

/**
 * Immutable, branded specification of a module's typed I/O contract.
 * A Signature pairs a `Schema.Struct` for inputs with a `Schema.Struct`
 * for outputs, a human-readable `description`, and auto-derived
 * `instructions` text. Modules receive their Signature at construction
 * time and never mutate it — optimizers change the module's `ModuleParams`,
 * not its Signature.
 *
 * @see {@link make} — canonical constructor that validates and derives fields
 * @see {@link Input} — extracts the decoded input type
 * @see {@link Output} — extracts the decoded output type
 * @see {@link FieldInfo} — per-field metadata carried by the Signature
 *
 * @since 0.1.0
 * @category models
 */
export class Signature<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields
> extends Data.TaggedClass("Signature")<{
  readonly description: string
  readonly instructions: string
  readonly inputFields: I
  readonly outputFields: O
  readonly inputSchema: Schema.Struct<I>
  readonly outputSchema: Schema.Struct<O>
  readonly fields: ReadonlyArray<FieldInfo>
}> {}

/**
 * Extracts the decoded input type from a {@link Signature}.
 *
 * @see {@link Signature}
 * @see {@link Output} — the output counterpart
 * @since 0.1.0
 * @category type-level
 */
export type Input<S extends Signature> = Schema.Schema.Type<S["inputSchema"]>

/**
 * Extracts the decoded output type from a {@link Signature}.
 *
 * @see {@link Signature}
 * @see {@link Input} — the input counterpart
 * @since 0.1.0
 * @category type-level
 */
export type Output<S extends Signature> = Schema.Schema.Type<S["outputSchema"]>
