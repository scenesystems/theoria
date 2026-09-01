/**
 * Validated constructors for building {@link Signature} instances from
 * `Schema.Struct` field declarations.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option, Record, Schema } from "effect"
import { SignatureError } from "../Errors/signature.js"
import { fieldsToInfoArray } from "./fields.js"
import { deriveInstruction } from "./instructions.js"
import { Signature } from "./model.js"

const failSignature = (reason: string, field?: string): Effect.Effect<never, SignatureError> =>
  Effect.fail(new SignatureError({ reason, field }))

const validateFieldCollections = (
  inputFields: Schema.Struct.Fields,
  outputFields: Schema.Struct.Fields
): Effect.Effect<void, SignatureError> =>
  Effect.gen(function*() {
    const inputFieldNames = Record.keys(inputFields)
    const outputFieldNames = Record.keys(outputFields)

    yield* Option.match(Arr.head(inputFieldNames), {
      onSome: () => Effect.void,
      onNone: () => failSignature("input fields must not be empty")
    })

    yield* Option.match(Arr.head(outputFieldNames), {
      onSome: () => Effect.void,
      onNone: () => failSignature("output fields must not be empty")
    })

    const overlap = Arr.findFirst(inputFieldNames, (fieldName) => Record.has(outputFields, fieldName))

    yield* Option.match(overlap, {
      onNone: () => Effect.void,
      onSome: (fieldName) => failSignature("input and output field names must not overlap", fieldName)
    })
  })

/**
 * Builds a typed signature from input and output `Schema.Struct` field records.
 *
 * @remarks
 * Decoded input and output types are inferred from the supplied records. Both records must be non-empty,
 * and a field name may not occur in both records. Field descriptions and
 * optionality are copied into {@link FieldInfo}; {@link deriveInstruction}
 * produces the initial instruction text.
 * The returned Effect fails with `SignatureError` for an empty field record or
 * an overlapping field name. Schema decoding is performed later by a module,
 * not by this constructor.
 *
 * @typeParam I - Input `Schema.Struct` fields; preserve the inferred record instead of widening it.
 * @typeParam O - Output `Schema.Struct` fields; preserve the inferred record instead of widening it.
 * @param description - Task description used verbatim in the derived instructions.
 * @param inputFields - Non-empty input field definitions.
 * @param outputFields - Non-empty output field definitions with names distinct from `inputFields`.
 * @returns A signature whose instructions are derived from the supplied description and fields.
 *
 * @see {@link Signature} — the returned model
 * @see {@link describe} — annotate fields with human-readable descriptions
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  description: string,
  inputFields: I,
  outputFields: O
): Effect.Effect<Signature<I, O>, SignatureError> =>
  Effect.gen(function*() {
    yield* validateFieldCollections(inputFields, outputFields)

    const inputSchema = Schema.Struct(inputFields)
    const outputSchema = Schema.Struct(outputFields)
    const inputFieldInfo = fieldsToInfoArray(inputFields)
    const outputFieldInfo = fieldsToInfoArray(outputFields)
    const fields = Arr.appendAll(inputFieldInfo, outputFieldInfo)
    const instructions = deriveInstruction(description, inputFieldInfo, outputFieldInfo)

    return new Signature({
      description,
      instructions,
      inputFields,
      outputFields,
      inputSchema,
      outputSchema,
      fields
    })
  })
