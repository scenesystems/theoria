/**
 * Signature transformations for reasoning-text predictors.
 *
 * @since 0.1.0
 */
import { Effect, Record, Schema } from "effect"
import { SignatureError } from "../../Errors/signature.js"
import * as Signature from "../../Signature/index.js"

const REASONING_FIELD_NAME = "reasoning"
const REASONING_DESCRIPTION = "Step-by-step reasoning shown before the final answer"
const REASONING_INSTRUCTION =
  "Return your step-by-step reasoning in the `reasoning` field before the final answer fields."

const reasoningField = Signature.describe(Schema.String, REASONING_DESCRIPTION)

const withReasoningInstructions = (instructions: string): string => `${instructions}\n\n${REASONING_INSTRUCTION}`

/**
 * Adds a required `reasoning` string schema before an existing output field map.
 *
 * @remarks
 * If `O` already contains `reasoning`, this type-level intersection does not
 * report the runtime collision. {@link toChainOfThoughtSignature} rejects that
 * case with `SignatureError`.
 *
 * @typeParam O - Original output fields retained after `reasoning`.
 *
 * @since 0.1.0
 * @category models
 */
export type ChainOfThoughtOutputFields<O extends Schema.Struct.Fields> =
  & O
  & Record<"reasoning", typeof reasoningField>

const chainOfThoughtOutputFields = <O extends Schema.Struct.Fields>(
  outputFields: O
): ChainOfThoughtOutputFields<O> => ({
  reasoning: reasoningField,
  ...outputFields
})

/**
 * Prepends the required reasoning field and updates the generated instructions.
 *
 * @remarks
 * The source signature remains unchanged. A `SignatureError` reports an
 * existing output named `reasoning`; errors from rebuilding the signature use
 * the same failure type.
 *
 * @typeParam I - Input fields preserved from the source signature.
 * @typeParam O - Existing output fields placed after `reasoning`.
 * @param signature - Source signature to copy and extend.
 * @returns A new signature with the same inputs and an extended output schema.
 *
 * @since 0.1.0
 * @category combinators
 */
export const toChainOfThoughtSignature = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature.Signature<I, O>
): Effect.Effect<Signature.Signature<I, ChainOfThoughtOutputFields<O>>, SignatureError> =>
  Effect.if(
    Record.has(signature.outputFields, REASONING_FIELD_NAME),
    {
      onTrue: () =>
        Effect.fail(
          new SignatureError({
            reason: "output fields already define reasoning; chainOfThought owns this field",
            field: REASONING_FIELD_NAME
          })
        ),
      onFalse: () =>
        Signature.make(
          signature.description,
          signature.inputFields,
          chainOfThoughtOutputFields(signature.outputFields)
        ).pipe(
          Effect.map(
            (withReasoning) =>
              new Signature.Signature({
                description: withReasoning.description,
                instructions: withReasoningInstructions(withReasoning.instructions),
                inputFields: withReasoning.inputFields,
                outputFields: withReasoning.outputFields,
                inputSchema: withReasoning.inputSchema,
                outputSchema: withReasoning.outputSchema,
                fields: withReasoning.fields
              })
          )
        )
    }
  )
