/**
 * Runtime schemas and prompt metadata that define a module boundary.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

/**
 * Records prompt metadata derived from one input or output field.
 *
 * @remarks
 * {@link make} obtains optionality from the property signature and descriptions
 * from {@link describe} annotations.
 *
 * @since 0.1.0
 * @category models
 */
export class FieldInfo extends Schema.Class<FieldInfo>("FieldInfo")({
  /** Property key rendered in the derived instructions. */
  name: Schema.String,
  /** Caller-authored field meaning, when the field schema has a description annotation. */
  description: Schema.OptionFromSelf(Schema.String),
  /** Whether the struct property may be omitted from decoded values. */
  isOptional: Schema.Boolean
}) {}

/**
 * Fixes the decoded input and output boundary used by a module.
 *
 * @remarks
 * Module execution decodes through the retained struct schemas. Optimizers may
 * replace a module's instruction parameters, but they do not alter this value or
 * its input and output types.
 *
 * @typeParam I - Input fields retained by `inputSchema` and {@link Input}.
 * @typeParam O - Output fields retained by `outputSchema` and {@link Output}.
 *
 * @since 0.1.0
 * @category models
 */
export class Signature<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields
> extends Data.TaggedClass("Signature")<{
  /** Task description supplied to {@link make}. */
  readonly description: string
  /** Default prompt derived from the task description and field metadata. */
  readonly instructions: string
  /** Original input field record. */
  readonly inputFields: I
  /** Original output field record. */
  readonly outputFields: O
  /** Struct schema used to decode module inputs. */
  readonly inputSchema: Schema.Struct<I>
  /** Struct schema used to decode module outputs. */
  readonly outputSchema: Schema.Struct<O>
  /** Input metadata followed by output metadata, preserving field order. */
  readonly fields: ReadonlyArray<FieldInfo>
}> {}

/**
 * Selects the decoded input represented by a {@link Signature}.
 *
 * @typeParam S - Value carrying the schema that decodes module inputs.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Input<S extends { readonly inputSchema: Schema.Schema.Any }> = Schema.Schema.Type<S["inputSchema"]>

/**
 * Selects the decoded output represented by a {@link Signature}.
 *
 * @typeParam S - Value carrying the schema that decodes module outputs.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Output<S extends { readonly outputSchema: Schema.Schema.Any }> = Schema.Schema.Type<S["outputSchema"]>
