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
 * Build a validated {@link Signature} from a description string, input
 * fields, and output fields. Validates that both field sets are
 * non-empty and that no field name appears in both inputs and outputs.
 * Automatically derives the `instructions` text and extracts
 * {@link FieldInfo} metadata from each Schema property.
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
