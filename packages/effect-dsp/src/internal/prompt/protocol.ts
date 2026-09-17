/**
 * Shared DSPy-compatible marker grammar and output-template contracts.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Boolean, Schema } from "effect"

/**
 * Ordered field names shared by marker rendering and parsing.
 *
 * @since 0.1.0
 * @category schemas
 * @internal
 */
export const FieldNames = Schema.Array(Schema.String)

/**
 * Regex that matches the `[[ ## fieldName ## ]]` marker grammar, capturing
 * the field name in group 1.
 *
 * Shared by prompt rendering (to emit markers) and text-output parsing
 * (to extract field values).
 *
 * @since 0.1.0
 * @category constants
 * @internal
 */
export const fieldMarkerRegex = /\[\[\s*##\s*([^#\]]+)\s*##\s*\]\]/g

/**
 * Produces a single `[[ ## fieldName ## ]]` marker string for the given
 * field name.
 *
 * @since 0.1.0
 * @category formatters
 * @internal
 */
export const renderFieldMarker = (fieldName: string): string => Arr.join(Arr.make("[[ ## ", fieldName, " ## ]]"), "")

const renderOutputTemplateLine = (fieldName: string): string =>
  Arr.join(Arr.make(renderFieldMarker(fieldName), "\n<", fieldName, ">"), "")

/**
 * Renders the output template block that teaches the LLM the expected
 * marker-delimited response format — one `[[ ## field ## ]]` marker per
 * output field followed by a `[[ ## completed ## ]]` sentinel.
 *
 * @since 0.1.0
 * @category formatters
 * @internal
 */
export const renderOutputTemplate = (fieldNames: typeof FieldNames.Type): string =>
  Arr.join(
    Arr.append(Arr.map(fieldNames, renderOutputTemplateLine), renderFieldMarker("completed")),
    "\n\n"
  )

/**
 * Renders a natural-language instruction that reminds the LLM which field
 * markers to emit and in what order, appended after the user's input values.
 *
 * When there are no output fields, instructs the model to respond with only
 * the `completed` marker.
 *
 * @since 0.1.0
 * @category formatters
 * @internal
 */
export const renderOutputRequirements = (fieldNames: typeof FieldNames.Type): string =>
  Boolean.match(Arr.isEmptyReadonlyArray(fieldNames), {
    onTrue: () => "Respond with the marker `[[ ## completed ## ]]`.",
    onFalse: () =>
      Arr.join(
        Arr.make(
          "Respond with the corresponding output fields, starting with the field ",
          Arr.join(
            Arr.map(fieldNames, (fieldName) => Arr.join(Arr.make("`", renderFieldMarker(fieldName), "`"), "")),
            ", then "
          ),
          ", and then ending with the marker for `",
          renderFieldMarker("completed"),
          "`."
        ),
        ""
      )
  })
