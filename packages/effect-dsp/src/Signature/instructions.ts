/**
 * Default instruction rendering for module signatures.
 *
 * @since 0.1.0
 */
import { Array as Arr, Option } from "effect"
import type { FieldInfo } from "./model.js"

const renderField = (field: FieldInfo): string =>
  Option.match(field.description, {
    onNone: () => field.name,
    onSome: (description) => `${field.name} (${description})`
  })

const renderFieldSection = (
  sectionName: string,
  fields: ReadonlyArray<FieldInfo>
): string => `${sectionName}: ${Arr.join(Arr.map(fields, renderField), ", ")}`

/**
 * Renders the initial instruction prompt from task and field metadata.
 *
 * @remarks
 * The result contains `Task`, `Input fields`, and `Output fields` lines in that
 * order. Fields retain array order. A description is appended in parentheses;
 * fields without one are rendered by name alone.
 *
 * @param description - Text rendered after `Task:`.
 * @param inputFields - Input metadata rendered in array order.
 * @param outputFields - Output metadata rendered in array order.
 * @returns Three newline-separated task, input, and output lines.
 *
 * @since 0.1.0
 * @category constructors
 */
export const deriveInstruction = (
  description: string,
  inputFields: ReadonlyArray<FieldInfo>,
  outputFields: ReadonlyArray<FieldInfo>
): string =>
  [
    `Task: ${description}`,
    renderFieldSection("Input fields", inputFields),
    renderFieldSection("Output fields", outputFields)
  ].join("\n")
