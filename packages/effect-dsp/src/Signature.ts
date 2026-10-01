/**
 * Runtime schemas and prompt metadata that define a module boundary.
 *
 * @since 0.1.0
 * @module
 */
import { Data, Schema } from "effect"
import { dual } from "effect/Function"
import { type Codec, codec } from "./Demonstration.js"
import { make as makeInternal } from "./internal/signature/constructors.js"
import { deriveInstruction as deriveInstructionInternal } from "./internal/signature/instructions.js"

/** Annotation identifier used for field descriptions.
 * @since 0.1.0
 * @category annotations
 */
export const FieldDescriptionId: unique symbol = Symbol.for("@scenesystems/effect-dsp/Signature/FieldDescriptionId")

/** Attaches descriptive prompt metadata to a signature field.
 * @since 0.1.0
 * @category annotations
 */
export const describe: {
  (description: string): <S extends Schema.Annotable.All>(schema: S) => Schema.Annotable.Self<S>
  <S extends Schema.Annotable.All>(schema: S, description: string): Schema.Annotable.Self<S>
} = dual(
  2,
  <S extends Schema.Annotable.All>(schema: S, description: string): Schema.Annotable.Self<S> =>
    Schema.annotations(schema, { [FieldDescriptionId]: description })
)

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
export class FieldInfo extends Schema.Class<FieldInfo>("@scenesystems/effect-dsp/Signature/FieldInfo")({
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
  readonly fields: Schema.Array$<typeof FieldInfo>["Type"]
}> {
  /**
   * Destination-owned demonstration operations derived from the retained schemas.
   * Compiled once so projections of this signature retain the same contract.
   * @since 0.4.0
   */
  readonly demonstrationCodec: Codec = codec(this.inputSchema, this.outputSchema)
}

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

/** Constructs a validated module signature and derives its instructions.
 * @since 0.1.0
 * @category constructors
 */
export const make = makeInternal

/** Renders initial instructions from task and field metadata.
 * @since 0.1.0
 * @category constructors
 */
export const deriveInstruction = deriveInstructionInternal
