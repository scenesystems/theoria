/**
 * Training and demonstration data types for optimization datasets.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { FieldRecord } from "../contracts/FieldValue.js"

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/**
 * A training example — an input/output pair for optimization datasets.
 *
 * `output` is optional: unlabeled examples (input-only) are used in MIPROv2
 * Phase 2 for instruction proposal.
 *
 * @since 0.1.0
 * @category models
 * @see {@link Demo}
 */
export class Example extends Schema.Class<Example>("Example")({
  input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  output: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  metadata: Schema.optional(FieldRecord)
}) {}

/**
 * A demonstration — a complete input/output pair used as a few-shot example.
 *
 * Unlike `Example`, both input and output are required.
 *
 * @since 0.1.0
 * @category models
 * @see {@link Example}
 */
export class Demo extends Schema.Class<Demo>("Demo")({
  input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  output: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}
