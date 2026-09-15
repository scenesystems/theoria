/**
 * Serializable records captured from model invocations.
 *
 * @since 0.1.0
 */
import * as Response from "@effect/ai/Response"
import { Option, Schema } from "effect"
import { Payload } from "../contracts/Payload.js"

/**
 * The output document of a ReAct iteration that has no decoded answer yet.
 * Decode intermediate entry output with this schema; completed answers use
 * the module's output schema. Tool-only iterations have no parse error.
 *
 * @since 0.4.0
 * @category schemas
 */
export const UnparsedOutput = Schema.Struct({
  response: Schema.String,
  parseError: Schema.Option(Schema.String),
  toolCallCount: Schema.Number,
  toolResultCount: Schema.Number
})

/**
 * Captures a successful module invocation or one ReAct iteration.
 *
 * @remarks
 * Input and decoded answers are schema-encoded JSON documents; use
 * `decodePayload` with the invocation's signature to recover typed values.
 * Intermediate ReAct output uses {@link UnparsedOutput}. Prompt and raw response
 * data are retained verbatim. For successful invocations, usage
 * is the final successful invocation's selected native usage, not a retry total.
 * Provider observation takes precedence over returned-response usage wholesale.
 *
 * @since 0.1.0
 * @category models
 */
export class Entry extends Schema.Class<Entry>("TraceEntry")({
  /** Invoked module name. */
  moduleName: Schema.String,
  /** Description from the module signature. */
  signatureDescription: Schema.String,
  /** Schema-encoded input document, decoded with the input signature. */
  input: Payload,
  /** Schema-encoded answer or intermediate {@link UnparsedOutput} document. */
  output: Payload,
  /** Intermediate ReAct turns are evidence, not replayable demonstrations. */
  outcome: Schema.optionalWith(Schema.Literal("completed", "intermediate"), { default: () => "completed" }),
  /** Rendered prompt sent to the language model. */
  prompt: Schema.String,
  /** Unparsed language-model response text. */
  rawResponse: Schema.String,
  /** Same selected native usage as the final successful invocation's Call. */
  usage: Response.Usage,
  /** Invocation duration in milliseconds. */
  durationMs: Schema.Number,
  /** Optional score assigned to this invocation. */
  score: Schema.Option(Schema.Number),
  /** Invocation timestamp in Unix epoch milliseconds. */
  timestamp: Schema.Number
}) {}

/**
 * Captures one DSP-visible model call independently of successful trace entries.
 *
 * @remarks
 * Calls intentionally retain no prompt or failure content. One DSP-visible call
 * is not guaranteed to correspond to one physical provider attempt.
 *
 * @since 0.4.0
 * @category models
 */
export class Call extends Schema.Class<Call>("TraceCall")({
  /** Language-model operation observed by the DSP runtime. */
  operation: Schema.Literal("generateObject", "generateText"),
  /** Provider usage when it was observed before the invocation terminated. */
  usage: Schema.Option(Response.Usage),
  /** Terminal invocation outcome without failure details. */
  outcome: Schema.Literal("success", "failure", "interrupted"),
  /** Invocation duration in milliseconds. */
  durationMs: Schema.Number,
  /** Invocation completion time in Unix epoch milliseconds. */
  timestamp: Schema.Number
}) {}

/**
 * Absent score used when an invocation has not been evaluated.
 *
 * @since 0.1.0
 * @category constants
 */
export const noScore: Option.Option<number> = Option.none()
