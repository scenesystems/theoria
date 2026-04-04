/**
 * Prompt rendering for predictor modules.
 *
 * @since 0.1.0
 * @internal
 */
import type * as Prompt from "@effect/ai/Prompt"
import { Array as Arr, Match, Option, Predicate, Record, Schema } from "effect"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import type { FieldInfo, Signature } from "../../Signature/model.js"
import { renderFieldMarker, renderOutputRequirements, renderOutputTemplate } from "./protocol.js"

const FieldValueRecord = Schema.Record({ key: Schema.String, value: Schema.Unknown })
type FieldValueRecord = typeof FieldValueRecord.Type

const renderUnknown = (value: unknown): string =>
  Match.value(value).pipe(
    Match.when(Predicate.isString, (text) => text),
    Match.when(Predicate.isNumber, (numberValue) => String(numberValue)),
    Match.when(Predicate.isBoolean, (booleanValue) => String(booleanValue)),
    Match.orElse(() => "[non-scalar]")
  )

const renderFieldLine = (name: string, description: Option.Option<string>): string =>
  Option.match(description, {
    onNone: () => `- ${name}`,
    onSome: (value) => `- ${name}: ${value}`
  })

const fieldDescription = (
  fields: ReadonlyArray<FieldInfo>,
  fieldName: string
): Option.Option<string> =>
  Arr.findFirst(fields, (field) => field.name === fieldName).pipe(
    Option.flatMap((field) => field.description)
  )

const renderFieldSection = (
  fieldNames: ReadonlyArray<string>,
  fields: ReadonlyArray<FieldInfo>
): string =>
  Arr.join(
    Arr.map(fieldNames, (fieldName) => renderFieldLine(fieldName, fieldDescription(fields, fieldName))),
    "\n"
  )

const hasField = (fieldName: string) => (candidate: unknown): candidate is Record<string, unknown> =>
  Predicate.hasProperty(candidate, fieldName)

const lookupValue = (values: unknown, fieldName: string): Option.Option<unknown> =>
  Match.value(values).pipe(
    Match.when(
      hasField(fieldName),
      (candidate) => Option.some(candidate[fieldName])
    ),
    Match.orElse(() => Option.none<unknown>())
  )

const renderFieldBlock = (
  fields: FieldValueRecord,
  values: unknown
): string =>
  Arr.join(
    Arr.map(Record.keys(fields), (fieldName) => {
      const value = Option.getOrElse(lookupValue(values, fieldName), () => "[missing]")

      return `${renderFieldMarker(fieldName)}\n${renderUnknown(value)}`
    }),
    "\n\n"
  )

const renderMainRequestContent = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>,
  input: Schema.Schema.Type<Schema.Struct<I>>
): string =>
  Arr.join(
    [
      renderFieldBlock(signature.inputFields, input),
      renderOutputRequirements(Record.keys(signature.outputFields))
    ],
    "\n\n"
  )

const buildSystemMessage = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>,
  params: ModuleParams
): string => {
  const inputFields = renderFieldSection(Record.keys(signature.inputFields), signature.fields)
  const outputFields = renderFieldSection(Record.keys(signature.outputFields), signature.fields)
  const outputTemplate = renderOutputTemplate(Record.keys(signature.outputFields))

  return [
    `Task: ${signature.description}`,
    `Instructions: ${params.instructions}`,
    `Input fields:\n${inputFields}`,
    `Output fields:\n${outputFields}`,
    `Output template:\n${outputTemplate}`
  ].join("\n\n")
}

const demoMessages = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>,
  params: ModuleParams
): ReadonlyArray<Prompt.MessageEncoded> =>
  Arr.flatMap(params.demos, (demo) => [
    {
      role: "user",
      content: renderFieldBlock(signature.inputFields, demo.input)
    },
    {
      role: "assistant",
      content: renderFieldBlock(signature.outputFields, demo.output)
    }
  ])

/**
 * Assembles a multi-message prompt payload ready for LLM submission.
 *
 * **Messages produced (in order):**
 * - A system message containing the task description, instructions,
 *   input/output field metadata, and the output template
 * - One user/assistant message pair per demonstration in the module params
 * - A user message with the current input values and output-format reminder
 * - An optional feedback message when a previous parse attempt failed
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const buildPrompt = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>,
  params: ModuleParams,
  input: Schema.Schema.Type<Schema.Struct<I>>,
  feedback: Option.Option<string> = Option.none()
): Prompt.RawInput => {
  const systemMessage: Prompt.MessageEncoded = {
    role: "system",
    content: buildSystemMessage(signature, params)
  }

  const inputMessage: Prompt.MessageEncoded = {
    role: "user",
    content: renderMainRequestContent(signature, input)
  }

  const baseMessages = Arr.append(
    Arr.appendAll([systemMessage], demoMessages(signature, params)),
    inputMessage
  )

  return Option.match(feedback, {
    onNone: () => baseMessages,
    onSome: (value) =>
      Arr.append(baseMessages, {
        role: "user",
        content: `Parse feedback:\n${value}\n\nPlease return corrected output using the required field markers.`
      })
  })
}
