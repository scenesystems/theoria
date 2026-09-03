/**
 * Validated construction of module signatures from Effect Schema fields.
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
 * Constructs a module signature and derives its initial instructions.
 *
 * @remarks
 * Both field records must contain at least one field, and their names must be
 * disjoint. Violations fail with `SignatureError`. Field descriptions and
 * optionality are copied into {@link FieldInfo}; values are decoded only when a
 * module executes.
 *
 * @typeParam I - Input fields retained for decoded-input inference.
 * @typeParam O - Output fields retained for decoded-output inference.
 * @param description - Task description used verbatim in the derived instructions.
 * @param inputFields - Non-empty input field definitions.
 * @param outputFields - Non-empty output field definitions with names distinct from `inputFields`.
 * @returns A signature with struct schemas, field metadata, and derived instructions.
 *
 * @example
 * ```ts
 * import * as Signature from "@scenesystems/effect-dsp/Signature"
 * import { Array as Arr, Effect, Option, Schema } from "effect"
 *
 * export const program = Effect.gen(function*() {
 *   const signature = yield* Signature.make(
 *     "Answer a question",
 *     { question: Signature.describe(Schema.String, "Question supplied by the caller") },
 *     { answer: Signature.describe(Schema.String, "Short factual answer") }
 *   )
 *
 *   const input: Signature.Input<typeof signature> = { question: "What is 2 + 2?" }
 *   const question = yield* Option.match(
 *     Arr.findFirst(signature.fields, (field) => field.name === "question"),
 *     {
 *       onNone: () => Effect.fail("MissingQuestionField"),
 *       onSome: Effect.succeed
 *     }
 *   )
 *
 *   return yield* Effect.succeed(input).pipe(
 *     Effect.filterOrFail(
 *       (current) => current.question === "What is 2 + 2?" && Option.isSome(question.description),
 *       () => "UnexpectedSignatureMetadata"
 *     )
 *   )
 * })
 * ```
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
