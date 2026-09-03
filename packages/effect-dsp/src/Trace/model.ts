/**
 * Serializable records captured from module invocations.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"
import { FieldRecord } from "../contracts/FieldValue.js"

/**
 * Captures one module invocation for diagnostics and evaluation.
 *
 * @remarks
 * Input, output, prompt, and raw response data are retained verbatim. The schema
 * performs no redaction, so callers must treat entries according to the
 * sensitivity of their module data.
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
  /** Provider-reported input tokens, absent when the provider omits usage. */
  inputTokens: Schema.OptionFromSelf(Schema.Number),
  /** Provider-reported output tokens, absent when the provider omits usage. */
  outputTokens: Schema.OptionFromSelf(Schema.Number),
  /** Invocation duration in milliseconds. */
  durationMs: Schema.Number,
  /** Optional score assigned to this invocation. */
  score: Schema.OptionFromSelf(Schema.Number),
  /** Invocation timestamp in Unix epoch milliseconds. */
  timestamp: Schema.Number
}) {}

/**
 * Absent score used when an invocation has not been evaluated.
 *
 * @since 0.1.0
 * @category constants
 */
export const noScore: Option.Option<number> = Option.none()
