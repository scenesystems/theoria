/**
 * Schema-owned prompt rendering for predictor modules.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Effect, Option, Predicate, Record, Schema, String, Struct } from "effect"
import * as AiError from "effect/ai/AiError"
import * as Prompt from "effect/ai/Prompt"
import type { ModuleParameters } from "../../ModuleParameters.js"
import { encode } from "../../Payload.js"
import { FieldInfo, type Signature } from "../../Signature.js"
import { effective } from "../signature/effective.js"
import { encodedFieldSchema, encodedFieldsToInfoArray, fieldsToInfoArray } from "../signature/fields.js"
import { renderFieldMarker, renderOutputRequirements, renderOutputTemplate } from "./protocol.js"

const promptError = () =>
  AiError.make({
    module: "Prompt",
    method: "buildPrompt",
    reason: new AiError.InvalidRequestError({
      description: "Prompt input could not be encoded without losing information"
    })
  })

const renderValue = <A, I>(schema: Schema.Codec<A, I>, value: A): Effect.Effect<string, AiError.AiError> =>
  Option.match(Option.liftPredicate(Predicate.isString)(value), {
    onSome: (text) => Effect.succeed(text),
    onNone: () => encode(schema, value).pipe(Effect.mapError(promptError))
  })

const renderFieldLine = (name: string, description: Option.Option<string>): string =>
  Option.match(description, {
    onNone: () => String.concat("- ", name),
    onSome: (value) => Arr.join(Arr.make("- ", name, ": ", value), "")
  })

const renderFieldSection = (fields: Iterable<FieldInfo>): string =>
  Arr.join(
    Arr.map(Arr.fromIterable(fields), (field) =>
      renderFieldLine(
        Option.match(field.prefix, { onNone: () => field.name, onSome: (prefix) => `${field.name} (${prefix})` }),
        field.description
      )),
    "\n"
  )

// Signature constructors accept Struct and encodeKeys(Struct), both preserving
// field order. Pair decoded metadata with its wire key rather than renaming markers.
const promptFields = (schema: Schema.Top, fields: ReadonlyArray<FieldInfo>) =>
  Arr.zipWith(
    fieldsToInfoArray(schema),
    encodedFieldsToInfoArray(schema),
    (decoded, encoded) =>
      new FieldInfo(Struct.assign(
        Option.getOrElse(Arr.findFirst(fields, (field) => field.name === decoded.name), () => decoded),
        { name: encoded.name }
      ))
  )

const renderFieldBlock = <A extends Record.ReadonlyRecord<string, unknown>>(schema: Schema.Schema<A>, values: A) =>
  Effect.forEach(Record.keys(values), (name) =>
    Effect.gen(function*() {
      const field = yield* Effect.fromOption(encodedFieldSchema(schema, name), promptError)
      const value = yield* Schema.decodeEffect(field)(values[name]).pipe(Effect.mapError(promptError))
      const text = yield* renderValue(field, value)
      return Arr.join(Arr.make(renderFieldMarker(name), text), "\n")
    })).pipe(Effect.map(Arr.join("\n\n")))

/**
 * Encodes signature inputs before rendering and constructs a native prompt.
 * Demonstrations already carry serialized field records. Structured values are
 * encoded as JSON, while string fields retain their original text.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const buildPrompt = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  signature: Signature<I, O>,
  params: ModuleParameters,
  input: Schema.Schema.Type<Schema.Struct<I>>,
  feedback: Option.Option<string> = Option.none()
): Effect.Effect<Prompt.Prompt, AiError.AiError, Schema.Struct<I>["EncodingServices"]> =>
  Effect.gen(function*() {
    const composed = effective(signature, params)
    const inputFields = promptFields(signature.inputSchema, composed.fields)
    const outputFields = promptFields(signature.outputSchema, composed.fields)
    const outputNames = Arr.map(outputFields, (field) => field.name)
    const encoded = yield* Schema.encodeEffect(signature.inputSchema)(input).pipe(Effect.mapError(promptError))
    const content = yield* renderFieldBlock(Schema.toEncoded(signature.inputSchema), encoded)
    const demonstrations = yield* Effect.forEach(params.demos, (demo) =>
      Effect.gen(function*() {
        const validated = yield* signature.demonstrationCodec.decode(demo).pipe(Effect.mapError(promptError))
        const input = yield* renderFieldBlock(Schema.toEncoded(signature.inputSchema), validated.input)
        const output = yield* renderFieldBlock(Schema.toEncoded(signature.outputSchema), validated.output)
        return Arr.make(
          Prompt.userMessage({ content: Arr.make(Prompt.textPart({ text: input })) }),
          Prompt.assistantMessage({ content: Arr.make(Prompt.textPart({ text: output })) })
        )
      }))
    const messages = Arr.append(
      Arr.appendAll(
        Arr.make(Prompt.systemMessage({
          content: Arr.join(
            Arr.make(
              String.concat("Task: ", signature.description),
              String.concat("Instructions: ", params.instructions),
              String.concat("Input fields:\n", renderFieldSection(inputFields)),
              String.concat("Output fields:\n", renderFieldSection(outputFields)),
              String.concat("Output template:\n", renderOutputTemplate(outputNames))
            ),
            "\n\n"
          )
        })),
        Arr.flatten(demonstrations)
      ),
      Prompt.userMessage({
        content: Arr.make(Prompt.textPart({
          text: Arr.join(Arr.make(content, renderOutputRequirements(outputNames)), "\n\n")
        }))
      })
    )
    return Prompt.fromMessages(Option.match(feedback, {
      onNone: () => messages,
      onSome: (value) =>
        Arr.append(
          messages,
          Prompt.userMessage({
            content: Arr.make(Prompt.textPart({
              text: Arr.join(
                Arr.make(
                  "Parse feedback:\n",
                  value,
                  "\n\nPlease return corrected output using the required field markers."
                ),
                ""
              )
            }))
          })
        )
    }))
  })
