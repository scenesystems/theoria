/**
 * Schema-owned prompt rendering for predictor modules.
 *
 * @since 0.1.0
 * @internal
 */
import * as AiError from "@effect/ai/AiError"
import * as Prompt from "@effect/ai/Prompt"
import { Array as Arr, Effect, Equal, Match, Option, Predicate, Record, Schema, String } from "effect"
import { type FieldRecord, FieldValue } from "../../contracts/FieldValue.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import { encodeAndProjectFieldRecord, projectFieldRecord } from "../../contracts/PayloadProjection.js"
import type { FieldInfo, Signature } from "../../Signature/model.js"
import { renderFieldMarker, renderOutputRequirements, renderOutputTemplate } from "./protocol.js"

const promptError = () =>
  new AiError.MalformedInput({
    module: "Prompt",
    method: "buildPrompt",
    description: "Prompt input could not be encoded without losing information"
  })

const JsonFieldValue = Schema.parseJson(FieldValue)
const fieldValueEquivalence = Schema.equivalence(FieldValue)

const renderValue = (value: FieldValue): Effect.Effect<string, AiError.MalformedInput> =>
  Match.value(value).pipe(
    Match.when(Predicate.isString, (value) => Effect.succeed(value)),
    Match.when(Predicate.isNumber, (value) => Schema.encode(Schema.NumberFromString)(value)),
    Match.orElse((value) =>
      Schema.encode(JsonFieldValue)(value).pipe(
        Effect.tap((text) =>
          Schema.decode(JsonFieldValue)(text).pipe(
            Effect.filterOrFail((decoded) => fieldValueEquivalence(value, decoded), promptError)
          )
        )
      )
    ),
    Effect.mapError(promptError)
  )

const renderFieldLine = (name: string, description: Option.Option<string>): string =>
  Option.match(description, {
    onNone: () => String.concat("- ", name),
    onSome: (value) => Arr.join(Arr.make("- ", name, ": ", value), "")
  })

const renderFieldSection = (fieldNames: Iterable<string>, fields: Iterable<FieldInfo>): string =>
  Arr.join(
    Arr.map(Arr.fromIterable(fieldNames), (name) =>
      renderFieldLine(
        name,
        Arr.findFirst(fields, (field) => Equal.equals(field.name, name)).pipe(
          Option.flatMap((field) => field.description)
        )
      )),
    "\n"
  )

const renderFieldBlock = (fields: Iterable<string>, values: FieldRecord) =>
  Effect.forEach(fields, (name) =>
    Option.match(Record.get(values, name), {
      onNone: () => Effect.succeed(String.concat(renderFieldMarker(name), "\n[missing]")),
      onSome: (value) =>
        renderValue(value).pipe(Effect.map((text) => Arr.join(Arr.make(renderFieldMarker(name), text), "\n")))
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
  params: ModuleParams,
  input: Schema.Schema.Type<Schema.Struct<I>>,
  feedback: Option.Option<string> = Option.none()
): Effect.Effect<Prompt.Prompt, AiError.MalformedInput, Schema.Schema.Context<Schema.Struct<I>>> =>
  Effect.gen(function*() {
    const inputNames = Record.keys(signature.inputFields)
    const outputNames = Record.keys(signature.outputFields)
    const encoded = yield* encodeAndProjectFieldRecord(signature.inputSchema, input, promptError)
    const content = yield* renderFieldBlock(inputNames, encoded)
    const demonstrations = yield* Effect.forEach(params.demos, (demo) =>
      Effect.gen(function*() {
        const input = yield* projectFieldRecord(demo.input, promptError).pipe(
          Effect.flatMap((record) => renderFieldBlock(inputNames, record))
        )
        const output = yield* projectFieldRecord(demo.output, promptError).pipe(
          Effect.flatMap((record) => renderFieldBlock(outputNames, record))
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
              String.concat("Input fields:\n", renderFieldSection(inputNames, signature.fields)),
              String.concat("Output fields:\n", renderFieldSection(outputNames, signature.fields)),
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
