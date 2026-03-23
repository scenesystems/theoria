/**
 * Chain-of-thought signature transformation contracts.
 *
 * @since 0.0.0
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
 * Output field contract that prepends a `reasoning: string` field to the
 * original output fields, capturing step-by-step reasoning before the
 * final answer.
 *
 * @since 0.0.0
 * @category models
 */
export type ChainOfThoughtOutputFields<O extends Schema.Struct.Fields> =
  & Readonly<{
    readonly reasoning: typeof reasoningField
  }>
  & O

const chainOfThoughtOutputFields = <O extends Schema.Struct.Fields>(
  outputFields: O
): ChainOfThoughtOutputFields<O> => ({
  reasoning: reasoningField,
  ...outputFields
})

/**
 * Extend a signature with a required `reasoning` output field and append
 * chain-of-thought instructions. Fails with `SignatureError` if the
 * output fields already contain a `reasoning` field.
 *
 * @since 0.0.0
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
