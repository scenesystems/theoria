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

const makeFieldRenderer = <A extends Record.ReadonlyRecord<string, unknown>>(
  schema: Schema.Schema<A>,
  name: string
) => {
  const fieldSchema = Schema.typeSchema(Schema.pluck(schema, name))
  const decode = Schema.decodeUnknown(fieldSchema)
  return (values: A) =>
    Option.match(Record.get(values, name), {
      onNone: () => Effect.fail(promptError()),
      onSome: (value) =>
        decode(value).pipe(
          Effect.mapError(promptError),
          Effect.flatMap((value) => renderValue(fieldSchema, value)),
          Effect.map((text) => Arr.join(Arr.make(renderFieldMarker(name), text), "\n"))
        )
    })
}

const makeFieldBlock = <A extends Record.ReadonlyRecord<string, unknown>>(
  schema: Schema.Schema<A>,
  fields: Iterable<FieldInfo>
) => {
  const renderers = Record.map(
    Record.fromIterableBy(fields, (field) => field.name),
    (_, name) => makeFieldRenderer(schema, name)
  )
  return (values: A) =>
    Effect.forEach(
      Record.keys(values),
      (name) => Option.getOrElse(Record.get(renderers, name), () => makeFieldRenderer(schema, name))(values)
    ).pipe(
      Effect.map(Arr.join("\n\n"))
    )
}

/**
 * Prepares signature metadata and schemas for repeated prompt construction.
 * Each invocation still encodes inputs and validates the current demonstrations.
 * Structured values are encoded as JSON, while strings retain their text.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const makePrompt = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  signature: Signature<I, O>
) => {
  const inputFields = encodedFieldsToInfoArray(signature.inputFields)
  const outputFields = encodedFieldsToInfoArray(signature.outputFields)
  const outputNames = Arr.map(outputFields, (field) => field.name)
  const inputSchema = Schema.encodedBoundSchema(signature.inputSchema)
  const outputSchema = Schema.encodedBoundSchema(signature.outputSchema)
  const renderInput = makeFieldBlock(inputSchema, inputFields)
  const renderOutput = makeFieldBlock(outputSchema, outputFields)
  const task = String.concat("Task: ", signature.description)
  const inputSection = String.concat("Input fields:\n", renderFieldSection(inputFields))
  const outputSection = String.concat("Output fields:\n", renderFieldSection(outputFields))
  const outputTemplate = String.concat("Output template:\n", renderOutputTemplate(outputNames))
  const outputRequirements = renderOutputRequirements(outputNames)

  return (
    params: ModuleParameters,
    input: Schema.Schema.Type<Schema.Struct<I>>,
    feedback: Option.Option<string> = Option.none()
  ): Effect.Effect<Prompt.Prompt, AiError.MalformedInput, Schema.Schema.Context<Schema.Struct<I>>> =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encode(signature.inputSchema)(input).pipe(Effect.mapError(promptError))
      const content = yield* renderInput(encoded)
      const demonstrations = yield* Effect.forEach(params.demos, (demo) =>
        Effect.gen(function*() {
          const input = yield* Schema.decodeUnknown(inputSchema)(demo.input).pipe(
            Effect.mapError(promptError),
            Effect.flatMap(renderInput)
          )
          const output = yield* Schema.decodeUnknown(outputSchema)(demo.output).pipe(
            Effect.mapError(promptError),
            Effect.flatMap(renderOutput)
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
                task,
                String.concat("Instructions: ", params.instructions),
                inputSection,
                outputSection,
                outputTemplate
              ),
              "\n\n"
            )
          })),
          Arr.flatten(demonstrations)
        ),
        Prompt.userMessage({
          content: Arr.make(Prompt.textPart({
            text: Arr.join(Arr.make(content, outputRequirements), "\n\n")
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
}
