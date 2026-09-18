/**
 * Schema-owned prompt rendering for predictor modules.
 *
 * @since 0.1.0
 * @internal
 */
import * as AiError from "@effect/ai/AiError"
import * as Prompt from "@effect/ai/Prompt"
import { Array as Arr, Effect, Option, Predicate, Record, Schema, String } from "effect"
import type { ModuleParameters } from "../../ModuleParameters.js"
import { encode } from "../../Payload.js"
import type { FieldInfo, Signature } from "../../Signature.js"
import { encodedFieldsToInfoArray } from "../signature/fields.js"
import { renderFieldMarker, renderOutputRequirements, renderOutputTemplate } from "./protocol.js"

const promptError = () =>
  new AiError.MalformedInput({
    module: "Prompt",
    method: "buildPrompt",
    description: "Prompt input could not be encoded without losing information"
  })

const renderValue = <A>(schema: Schema.Schema<A>, value: A): Effect.Effect<string, AiError.MalformedInput> =>
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
    Arr.map(Arr.fromIterable(fields), (field) => renderFieldLine(field.name, field.description)),
    "\n"
  )

const renderFieldBlock = <A extends Record.ReadonlyRecord<string, unknown>>(schema: Schema.Schema<A>, values: A) =>
  Effect.forEach(Record.keys(values), (name) => {
    const field = Schema.pluck(schema, name)
    return Schema.decodeUnknown(field)(values).pipe(
      Effect.mapError(promptError),
      Effect.flatMap((value) => renderValue(Schema.typeSchema(field), value)),
      Effect.map((text) => Arr.join(Arr.make(renderFieldMarker(name), text), "\n"))
    )
  }).pipe(Effect.map(Arr.join("\n\n")))

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
): Effect.Effect<Prompt.Prompt, AiError.MalformedInput, Schema.Schema.Context<Schema.Struct<I>>> =>
  Effect.gen(function*() {
    const inputFields = encodedFieldsToInfoArray(signature.inputFields)
    const outputFields = encodedFieldsToInfoArray(signature.outputFields)
    const outputNames = Arr.map(outputFields, (field) => field.name)
    const encoded = yield* Schema.encode(signature.inputSchema)(input).pipe(Effect.mapError(promptError))
    const content = yield* renderFieldBlock(Schema.encodedBoundSchema(signature.inputSchema), encoded)
    const demonstrations = yield* Effect.forEach(params.demos, (demo) =>
      Effect.gen(function*() {
        const input = yield* Schema.decodeUnknown(Schema.encodedBoundSchema(signature.inputSchema))(demo.input).pipe(
          Effect.mapError(promptError),
          Effect.flatMap((record) => renderFieldBlock(Schema.encodedBoundSchema(signature.inputSchema), record))
        )
        const output = yield* Schema.decodeUnknown(Schema.encodedBoundSchema(signature.outputSchema))(demo.output).pipe(
          Effect.mapError(promptError),
          Effect.flatMap((record) => renderFieldBlock(Schema.encodedBoundSchema(signature.outputSchema), record))
        )
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
