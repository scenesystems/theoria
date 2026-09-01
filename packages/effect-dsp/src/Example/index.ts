/**
 * Training and demonstration data types for optimization datasets.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/**
 * Dataset row with an input record and optional expected output. The records
 * accept unknown values and do not establish that labels are correct or
 * trusted; dataset owners remain responsible for validation. Input-only rows
 * can be passed where an optimizer supports unlabeled examples.
 *
 * @since 0.1.0
 * @category models
 * @see {@link Demo}
 */
export class Example extends Schema.Class<Example>("Example")({
  input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  output: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}) {}

/**
 * Complete input/output record intended for few-shot prompting. Both records
 * are required, but their values are otherwise unknown: construction proves
 * shape, not correctness, provenance, or permission to use the content.
 *
 * @since 0.1.0
 * @category models
 * @see {@link Example}
 */
export class Demo extends Schema.Class<Demo>("Demo")({
  input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  output: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}
