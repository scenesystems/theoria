/**
 * Trace data models.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"
import { FieldRecord } from "../contracts/FieldValue.js"

/**
 * Serializable record of one module invocation.
 *
 * @since 0.1.0
 * @category models
 */
export class Entry extends Schema.Class<Entry>("TraceEntry")({
  /** Invoked module name. */
  moduleName: Schema.String,
  /** Description from the module signature. */
  signatureDescription: Schema.String,
  /** Decoded module input fields. */
  input: FieldRecord,
  /** Decoded module output fields. */
  output: FieldRecord,
  /** Rendered prompt sent to the language model. */
  prompt: Schema.String,
  /** Unparsed language-model response text. */
  rawResponse: Schema.String,
  /** Provider-reported input tokens. */
  inputTokens: Schema.OptionFromSelf(Schema.Number),
  /** Provider-reported output tokens. */
  outputTokens: Schema.OptionFromSelf(Schema.Number),
  /** Invocation duration in milliseconds. */
  durationMs: Schema.Number,
  /** Optional score assigned to this invocation. */
  score: Schema.OptionFromSelf(Schema.Number),
  /** Invocation timestamp in Unix epoch milliseconds. */
  timestamp: Schema.Number
}) {}

/**
 * Reusable absent value for {@link Entry.score}.
 *
 * @since 0.1.0
 * @category constants
 */
export const noScore: Option.Option<number> = Option.none()
