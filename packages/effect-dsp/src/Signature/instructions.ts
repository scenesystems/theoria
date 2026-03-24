/**
 * Derives a module's default instruction prompt from its {@link Signature}
 * description and field metadata.
 *
 * @since 0.0.0
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
 * Derive the default instruction prompt from a signature's description
 * and field metadata. Produces a structured text block:
 * `Task: {description}\nInput fields: ...\nOutput fields: ...`
 * Used as the initial `instructions` value in {@link ModuleParams}.
 *
 * @see {@link Signature} — the source of description and field metadata
 * @see {@link ModuleParams} — where the derived instructions are stored
 *
 * @since 0.0.0
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
