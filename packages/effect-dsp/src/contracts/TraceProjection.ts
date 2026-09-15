/**
 * Schema-validated trace records used by optimizer objective functions.
 *
 * @since 0.1.0
 */
import * as Response from "@effect/ai/Response"
import type { ParseResult } from "effect"
import { Effect, Schema } from "effect"
import type { Entry } from "../Trace/model.js"
import { ModuleId } from "./ModuleId.js"
import { Payload } from "./Payload.js"

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
  /** Schema-encoded module input document. */
  input: Payload,
  /** Rendered prompt sent to the provider. */
  prompt: Schema.String,
  /** Schema-encoded module output document. */
  output: Payload,
  /** Evaluation score when one has been attached to the trace. */
  score: Schema.Option(Schema.Number),
  /** Unredacted provider response text. */
  rawResponse: Schema.String,
  /** Selected native invocation usage retained from the trace entry. */
  usage: Response.Usage,
  /** Invocation duration in milliseconds. */
  durationMs: Schema.Number,
  /** Invocation completion time in Unix epoch milliseconds. */
  timestamp: Schema.Number
}) {}

/**
 * Decodes a runtime trace entry into an optimizer objective payload.
 *
 * @param entry - Trace entry containing unredacted invocation data.
 * @returns A validated projection retaining the native usage value.
 *
 * @since 0.1.0
 * @category combinators
 */
export const projectTraceObjectiveProjection = (
  entry: Entry
): Effect.Effect<TraceObjectiveProjection, ParseResult.ParseError> =>
  Schema.decode(ModuleId)(entry.moduleName).pipe(
    Effect.map((moduleId) =>
      new TraceObjectiveProjection({
        moduleId,
        signatureDescription: entry.signatureDescription,
        input: entry.input,
        prompt: entry.prompt,
        output: entry.output,
        score: entry.score,
        rawResponse: entry.rawResponse,
        usage: entry.usage,
        durationMs: entry.durationMs,
        timestamp: entry.timestamp
      })
    )
  )
