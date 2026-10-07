/**
 * Validated construction of module signatures from Effect Schema fields.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Effect, Option, Record, Schema } from "effect"
import { SignatureError } from "../../DspError.js"
import { Signature } from "../../Signature.js"
import { encodedFieldsToInfoArray, fieldsToInfoArray } from "./fields.js"
import { deriveInstruction } from "./instructions.js"

const failSignature = (reason: string, field?: string): Effect.Effect<never, SignatureError> =>
  Effect.fail(new SignatureError({ reason, field }))

const validateFieldCollections = (
  inputFields: Schema.Struct.Fields,
  outputFields: Schema.Struct.Fields,
  allowEmptyInput: boolean
): Effect.Effect<void, SignatureError> =>
  Effect.gen(function*() {
    const inputFieldNames = Record.keys(inputFields)
    const outputFieldNames = Record.keys(outputFields)

    yield* Option.match(Arr.head(inputFieldNames), {
      onSome: () => Effect.void,
      onNone: () =>
        Boolean.match(allowEmptyInput, {
          onFalse: () => failSignature("input fields must not be empty"),
          onTrue: () => Effect.void
        })
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
 * import { Array as Arr, Boolean, Effect, Equal, Option, Schema } from "effect"
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
 *     Arr.findFirst(signature.fields, (field) => Equal.equals(field.name, "question")),
 *     {
 *       onNone: () => Effect.fail("MissingQuestionField"),
 *       onSome: Effect.succeed
 *     }
 *   )
 *
 *   return yield* Effect.succeed(input).pipe(
 *     Effect.filterOrFail(
 *       (current) => Boolean.and(Equal.equals(current.question, "What is 2 + 2?"), Option.isSome(question.description)),
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
  fromSchemas(description, Schema.Struct(inputFields), Schema.Struct(outputFields))

/** Constructs a signature while retaining the supplied input and output codecs. @internal */
export const fromSchemas = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  const IM extends { readonly [K in keyof I]?: PropertyKey },
  const OM extends { readonly [K in keyof O]?: PropertyKey }
>(
  description: string,
  inputSchema: Schema.Struct<I> | Schema.encodeKeys<Schema.Struct<I>, IM>,
  outputSchema: Schema.Struct<O> | Schema.encodeKeys<Schema.Struct<O>, OM>,
  allowEmptyInput = false
): Effect.Effect<Signature<I, O>, SignatureError> =>
  Effect.gen(function*() {
    const inputFields = "fields" in inputSchema ? inputSchema.fields : inputSchema.to.fields
    const outputFields = "fields" in outputSchema ? outputSchema.fields : outputSchema.to.fields
    yield* validateFieldCollections(inputFields, outputFields, allowEmptyInput)

    const inputFieldInfo = fieldsToInfoArray(inputSchema)
    const outputFieldInfo = fieldsToInfoArray(outputSchema)
    const fields = Arr.appendAll(inputFieldInfo, outputFieldInfo)
    const instructions = deriveInstruction(
      description,
      encodedFieldsToInfoArray(inputSchema),
      encodedFieldsToInfoArray(outputSchema)
    )

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
