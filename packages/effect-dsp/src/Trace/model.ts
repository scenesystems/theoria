/**
 * Trace data models.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"
import { FieldRecord } from "../contracts/FieldValue.js"

/**
 * A single trace entry recording one module invocation — captures input/output
 * field records, the rendered prompt, raw LLM response, token usage, duration,
 * and optional score.
 *
 * @since 0.1.0
 * @category models
 */
export class Entry extends Schema.Class<Entry>("TraceEntry")({
  moduleName: Schema.String,
  signatureDescription: Schema.String,
  input: FieldRecord,
  output: FieldRecord,
  prompt: Schema.String,
  rawResponse: Schema.String,
  inputTokens: Schema.OptionFromSelf(Schema.Number),
  outputTokens: Schema.OptionFromSelf(Schema.Number),
  durationMs: Schema.Number,
  score: Schema.OptionFromSelf(Schema.Number),
  timestamp: Schema.Number
}) {}

/**
 * Canonical "no score assigned" value for trace entries awaiting evaluation.
 *
 * @since 0.1.0
 * @category constants
 */
export const noScore: Option.Option<number> = Option.none()
