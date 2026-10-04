/**
 * Signature transformations for reasoning-text predictors.
 *
 * @since 0.1.0
 */
import { Array, Boolean, Effect, Inspectable, Predicate, Record, Schema, SchemaAST, SchemaGetter, Tuple } from "effect"
import { SignatureError } from "../../../DspError.js"
import type { ChainOfThoughtOutputFields } from "../../../Module.js"
import * as Signature from "../../../Signature.js"
import { encodedFieldsToInfoArray, fieldsToInfoArray } from "../../signature/fields.js"

const REASONING_FIELD_NAME = "reasoning"
const REASONING_DESCRIPTION = "Step-by-step reasoning shown before the final answer"
const REASONING_INSTRUCTION =
  "Return your step-by-step reasoning in the `reasoning` field before the final answer fields."

const reasoningField = Signature.describe(Schema.String, REASONING_DESCRIPTION)

const withReasoningInstructions = (instructions: string): string => `${instructions}\n\n${REASONING_INSTRUCTION}`

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
  Boolean.match(
    Boolean.or(
      Record.has(signature.inputFields, REASONING_FIELD_NAME),
      Record.has(signature.outputFields, REASONING_FIELD_NAME)
    ),
    {
      onTrue: () =>
        Effect.fail(
          new SignatureError({
            reason: "input or output fields already define reasoning; chainOfThought owns this field",
            field: REASONING_FIELD_NAME
          })
        ),
      onFalse: () =>
        Effect.gen(function*() {
          const encoded = Schema.toEncoded(signature.outputSchema).ast
          const wireFields = SchemaAST.isObjects(encoded)
            ? Record.fromEntries(Array.map(encoded.propertySignatures, (property) =>
              Tuple.make(
                Predicate.isNumber(property.name) ? Inspectable.toStringUnknown(property.name) : property.name,
                Schema.toType(Schema.make(property.type))
              )))
            : {}
          if (Record.has(wireFields, REASONING_FIELD_NAME)) {
            return yield* new SignatureError({
              reason: "encoded output fields already define reasoning; chainOfThought owns this field",
              field: REASONING_FIELD_NAME
            })
          }
          const outputFields = chainOfThoughtOutputFields(signature.outputFields)
          const decoded = Schema.toType(Schema.Struct(outputFields))
          const outputSchema = Schema.Struct({ reasoning: reasoningField, ...wireFields }).pipe(
            Schema.decodeTo(decoded, {
              decode: SchemaGetter.transformEffect((wire, options) =>
                Schema.decodeEffect(signature.outputSchema)(Record.remove(wire, REASONING_FIELD_NAME), options).pipe(
                  Effect.flatMap((output) =>
                    Schema.decodeUnknownEffect(decoded)({ reasoning: wire.reasoning, ...output })
                  ),
                  Effect.mapError((error) => error.issue)
                )
              ),
              encode: SchemaGetter.transformEffect((output, options) =>
                Effect.gen(function*() {
                  const { reasoning } = yield* Schema.decodeUnknownEffect(Schema.Struct({ reasoning: Schema.String }))(
                    output
                  )
                  const wire = yield* Schema.encodeUnknownEffect(signature.outputSchema)(
                    Record.remove(output, REASONING_FIELD_NAME),
                    options
                  )
                  return { reasoning, ...wire }
                }).pipe(
                  Effect.mapError((error) => error.issue)
                )
              )
            })
          )
          return new Signature.Signature<I, ChainOfThoughtOutputFields<O>>({
            description: signature.description,
            instructions: withReasoningInstructions(Signature.deriveInstruction(
              signature.description,
              encodedFieldsToInfoArray(signature.inputSchema),
              encodedFieldsToInfoArray(outputSchema)
            )),
            inputFields: signature.inputFields,
            outputFields,
            inputSchema: signature.inputSchema,
            // Adding a service-free String field preserves the original codec's
            // service channels. TypeScript cannot reduce that indexed intersection.
            outputSchema: Schema.make<Signature.Signature<I, ChainOfThoughtOutputFields<O>>["outputSchema"]>(
              outputSchema.ast
            ),
            fields: Array.appendAll(fieldsToInfoArray(signature.inputSchema), fieldsToInfoArray(outputSchema))
          })
        })
    }
  )
