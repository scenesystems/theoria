/**
 * Schema-validated trace records used by optimizer objective functions.
 *
 * @since 0.1.0
 */
import type { Effect, ParseResult } from "effect"
import { Schema } from "effect"
import type { Entry } from "../Trace/model.js"
import { FieldRecord } from "./FieldValue.js"
import { ModuleId } from "./ModuleId.js"
import { UsageSample } from "./Usage.js"

/**
 * Retains module input, output, prompt, response, usage, timing, and score data.
 *
 * @remarks
 * Prompt and response fields are not redacted. Consumers must apply storage and
 * logging controls appropriate for the source module data.
 *
 * @since 0.1.0
 * @category models
 */
export class TraceObjectiveProjection extends Schema.Class<TraceObjectiveProjection>("TraceObjectiveProjection")({
  /** Branded module identity decoded from the trace module name. */
  moduleId: ModuleId,
  /** Description copied from the module signature. */
  signatureDescription: Schema.String,
  /** Encoded module input fields. */
  input: FieldRecord,
  /** Rendered prompt sent to the provider. */
  prompt: Schema.String,
  /** Encoded module output fields. */
  output: FieldRecord,
  /** Evaluation score when one has been attached to the trace. */
  score: Schema.OptionFromSelf(Schema.Number),
  /** Unredacted provider response text. */
  rawResponse: Schema.String,
  /** Provider token counts with cache status fixed by the projection function. */
  usage: UsageSample,
  /** Invocation duration in milliseconds. */
  durationMs: Schema.Number,
  /** Invocation completion time in Unix epoch milliseconds. */
  timestamp: Schema.Number
}) {}

/**
 * Decodes a runtime trace entry into an optimizer objective payload.
 *
 * @remarks
 * Token counts are retained and `usage.cached` is set to `false` because trace
 * entries do not record cache resolution. The module name must satisfy
 * {@link ModuleId}; invalid names or payload fields fail with
 * `ParseResult.ParseError`.
 *
 * @param entry - Trace entry containing unredacted invocation data.
 * @returns A validated projection with explicit usage.
 *
 * @since 0.1.0
 * @category combinators
 */
export const projectTraceObjectiveProjection = (
  entry: Entry
): Effect.Effect<TraceObjectiveProjection, ParseResult.ParseError> =>
  Schema.decodeUnknown(TraceObjectiveProjection)({
    moduleId: entry.moduleName,
    signatureDescription: entry.signatureDescription,
    input: entry.input,
    prompt: entry.prompt,
    output: entry.output,
    score: entry.score,
    rawResponse: entry.rawResponse,
    usage: new UsageSample({
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      cached: false
    }),
    durationMs: entry.durationMs,
    timestamp: entry.timestamp
  })
