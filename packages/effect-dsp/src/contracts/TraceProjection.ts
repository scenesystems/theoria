/**
 * Stable projection of runtime trace entries into the shape consumed by
 * optimizer objective functions and observability dashboards.
 *
 * @since 0.0.0
 */
import type { Effect, ParseResult } from "effect"
import { Schema } from "effect"
import type { Entry } from "../Trace/model.js"
import { FieldRecord } from "./FieldValue.js"
import { ModuleId } from "./ModuleId.js"
import { UsageSample } from "./Usage.js"

/**
 * Deterministic, schema-validated projection of a single trace entry into
 * the fields an optimizer needs: module identity, I/O payloads, raw LM
 * response, token usage, timing, and optional score. Decouples optimizer
 * code from the internal `Trace.Entry` representation.
 *
 * @see {@link projectTraceObjectiveProjection} — canonical projection function
 * @see {@link UsageSample} — token usage snapshot carried by each projection
 *
 * @since 0.0.0
 * @category models
 */
export class TraceObjectiveProjection extends Schema.Class<TraceObjectiveProjection>("TraceObjectiveProjection")({
  moduleId: ModuleId,
  signatureDescription: Schema.String,
  input: FieldRecord,
  prompt: Schema.String,
  output: FieldRecord,
  score: Schema.OptionFromSelf(Schema.Number),
  rawResponse: Schema.String,
  usage: UsageSample,
  durationMs: Schema.Number,
  timestamp: Schema.Number
}) {}

/**
 * Convert a runtime `Trace.Entry` into a {@link TraceObjectiveProjection},
 * normalizing field names and wrapping token counts into a
 * {@link UsageSample}. Schema-validates the result to catch any
 * structural drift between the trace model and the projection contract.
 *
 * @see {@link TraceObjectiveProjection}
 *
 * @since 0.0.0
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
