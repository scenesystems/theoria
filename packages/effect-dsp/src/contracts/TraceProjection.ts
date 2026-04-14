/**
 * Stable projection of runtime trace entries into the shape consumed by
 * optimizer objective functions and observability dashboards.
 *
 * @since 0.1.0
 */
import type { ParseResult } from "effect"
import { Effect, Option, Schema } from "effect"
import type { Entry } from "../Trace/model.js"
import { FieldRecord } from "./FieldValue.js"
import { ModuleId } from "./ModuleId.js"
import { UsageSample } from "./Usage.js"

const totalTokens = (entry: Entry): number =>
  Option.getOrElse(entry.inputTokens, () => 0) + Option.getOrElse(entry.outputTokens, () => 0)

/**
 * Deterministic projection of a single trace entry into
 * the fields an optimizer needs: module identity, I/O payloads, raw LM
 * response, token usage, timing, and optional score. Decouples optimizer
 * code from the internal `Trace.Entry` representation.
 *
 * @see {@link TraceObjectiveProjection.fromTraceEntry} — canonical projection function
 * @see {@link UsageSample} — token usage snapshot carried by each projection
 *
 * @since 0.1.0
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
  totalTokens: Schema.Number,
  durationMs: Schema.Number,
  timestamp: Schema.Number
}) {
  /**
   * Convert a runtime `Trace.Entry` into a {@link TraceObjectiveProjection},
   * normalizing field names and wrapping token counts into a
   * {@link UsageSample}. The trace payload is already stable, but the
   * module identity still has to cross the branded `ModuleId` boundary.
   *
   * @since 0.1.0
   * @category combinators
   */
  static fromTraceEntry(
    entry: Entry
  ): Effect.Effect<TraceObjectiveProjection, ParseResult.ParseError> {
    return Effect.gen(function*() {
      const moduleId = yield* Schema.decodeUnknown(ModuleId)(entry.moduleName)

      return TraceObjectiveProjection.make({
        moduleId,
        signatureDescription: entry.signatureDescription,
        input: entry.input,
        prompt: entry.prompt,
        output: entry.output,
        score: entry.score,
        rawResponse: entry.rawResponse,
        usage: UsageSample.make({
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          cached: false
        }),
        totalTokens: totalTokens(entry),
        durationMs: entry.durationMs,
        timestamp: entry.timestamp
      })
    })
  }
}
