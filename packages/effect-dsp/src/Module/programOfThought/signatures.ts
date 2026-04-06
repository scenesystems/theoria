/**
 * Internal signature construction for `Module.programOfThought`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Array as Arr, Effect, Record, Schema } from "effect"
import { SignatureError } from "../../Errors/signature.js"
import * as Signature from "../../Signature/index.js"

const GENERATED_CODE_FIELD_NAME = "generated_code"
const PREVIOUS_CODE_FIELD_NAME = "previous_code"
const ERROR_FIELD_NAME = "error"
const FINAL_GENERATED_CODE_FIELD_NAME = "final_generated_code"
const CODE_OUTPUT_FIELD_NAME = "code_output"
const REASONING_FIELD_NAME = "reasoning"
const generatedCodeField = Signature.describe(Schema.String, "python code that answers the question")
const previousCodeField = Signature.describe(Schema.String, "previously-generated python code that errored")
const errorField = Signature.describe(Schema.String, "error message from previously-generated python code")
const finalGeneratedCodeField = Signature.describe(Schema.String, "python code that answers the question")
const codeOutputField = Signature.describe(Schema.String, "output of previously-generated python code")
const reservedFieldNames = Arr.make(
  REASONING_FIELD_NAME,
  GENERATED_CODE_FIELD_NAME,
  PREVIOUS_CODE_FIELD_NAME,
  ERROR_FIELD_NAME,
  FINAL_GENERATED_CODE_FIELD_NAME,
  CODE_OUTPUT_FIELD_NAME
)

/**
 * Output fields used by the planning and repair phases.
 *
 * @since 0.2.0
 * @category models
 * @internal
 */
export type ProgramGeneratedCodeFields = Readonly<{
  readonly generated_code: typeof generatedCodeField
}>

/**
 * Input augmentation used by the repair phase.
 *
 * @since 0.2.0
 * @category models
 * @internal
 */
export type ProgramRepairInputFields<I extends Schema.Struct.Fields> =
  & I
  & Readonly<{
    readonly previous_code: typeof previousCodeField
    readonly error: typeof errorField
  }>

/**
 * Input augmentation used by the final answer-projection phase.
 *
 * @since 0.2.0
 * @category models
 * @internal
 */
export type ProgramAnswerInputFields<I extends Schema.Struct.Fields> =
  & I
  & Readonly<{
    readonly final_generated_code: typeof finalGeneratedCodeField
    readonly code_output: typeof codeOutputField
  }>

const reservedFieldCollision = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature.Signature<I, O>
) =>
  Arr.findFirst(
    reservedFieldNames,
    (fieldName) => Record.has(signature.inputFields, fieldName) || Record.has(signature.outputFields, fieldName)
  )

const ensureReservedFieldNamesAvailable = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature.Signature<I, O>
): Effect.Effect<void, SignatureError> =>
  Effect.gen(function*() {
    const collision = reservedFieldCollision(signature)

    if (collision._tag === "Some") {
      return yield* Effect.fail(
        new SignatureError({
          reason: "programOfThought reserves helper field names for planning, repair, and answer projection",
          field: collision.value
        })
      )
    }

    return yield* Effect.void
  })

const fieldList = (fields: Schema.Struct.Fields): string =>
  Arr.join(
    Arr.map(Record.keys(fields), (fieldName) => `\`${fieldName}\``),
    ", "
  )

const withInstructions = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature.Signature<I, O>,
  instructions: string
): Signature.Signature<I, O> =>
  new Signature.Signature({
    description: signature.description,
    instructions,
    inputFields: signature.inputFields,
    outputFields: signature.outputFields,
    inputSchema: signature.inputSchema,
    outputSchema: signature.outputSchema,
    fields: signature.fields
  })

const makeInternalSignature = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  description: string,
  inputFields: I,
  outputFields: O,
  instructions: string
): Effect.Effect<Signature.Signature<I, O>, SignatureError> =>
  Signature.make(description, inputFields, outputFields).pipe(
    Effect.map((signature) => withInstructions(signature, instructions))
  )

/**
 * Build the planning signature used for the first program-generation phase.
 *
 * @since 0.2.0
 * @category combinators
 * @internal
 */
export const makeProgramGenerateSignature = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature.Signature<I, O>
): Effect.Effect<Signature.Signature<I, ProgramGeneratedCodeFields>, SignatureError> =>
  Effect.gen(function*() {
    yield* ensureReservedFieldNamesAvailable(signature)
    const finalOutputs = fieldList(signature.outputFields)

    return yield* makeInternalSignature(
      `${signature.description} — generate executable code`,
      signature.inputFields,
      { generated_code: generatedCodeField },
      [
        `You will be given ${
          fieldList(signature.inputFields)
        } and you will respond with \`${GENERATED_CODE_FIELD_NAME}\`.`,
        `Generate executable Python code that programmatically computes the correct output fields ${finalOutputs}.`,
        "After the computation is complete, make sure the program emits its final observable output through the interpreter boundary.",
        `Structure any explicit submission as a dict whose keys match the final output field(s): ${finalOutputs}.`
      ].join("\n")
    )
  })

/**
 * Build the repair signature used after a parse or execution failure.
 *
 * @since 0.2.0
 * @category combinators
 * @internal
 */
export const makeProgramRepairSignature = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature.Signature<I, O>
): Effect.Effect<Signature.Signature<ProgramRepairInputFields<I>, ProgramGeneratedCodeFields>, SignatureError> =>
  Effect.gen(function*() {
    yield* ensureReservedFieldNamesAvailable(signature)

    return yield* makeInternalSignature(
      `${signature.description} — repair executable code`,
      {
        ...signature.inputFields,
        previous_code: previousCodeField,
        error: errorField
      },
      { generated_code: generatedCodeField },
      [
        `You are given ${
          fieldList({ ...signature.inputFields, previous_code: previousCodeField, error: errorField })
        } due to an error in the previous program body.`,
        `Correct the failure and return a new \`${GENERATED_CODE_FIELD_NAME}\` that computes the original output fields ${
          fieldList(signature.outputFields)
        }.`,
        "Do not explain the fix outside the structured response fields."
      ].join("\n")
    )
  })

/**
 * Build the answer-projection signature used after execution succeeds.
 *
 * @since 0.2.0
 * @category combinators
 * @internal
 */
export const makeProgramAnswerSignature = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature.Signature<I, O>
): Effect.Effect<Signature.Signature<ProgramAnswerInputFields<I>, O>, SignatureError> =>
  Effect.gen(function*() {
    yield* ensureReservedFieldNamesAvailable(signature)

    return yield* makeInternalSignature(
      `${signature.description} — project final answer`,
      {
        ...signature.inputFields,
        final_generated_code: finalGeneratedCodeField,
        code_output: codeOutputField
      },
      signature.outputFields,
      `Given the final code ${
        fieldList({
          ...signature.inputFields,
          final_generated_code: finalGeneratedCodeField,
          code_output: codeOutputField
        })
      }, provide the final output fields ${fieldList(signature.outputFields)}.`
    )
  })
