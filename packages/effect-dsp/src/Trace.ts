/**
 * Serializable records captured from model invocations.
 *
 * @since 0.1.0
 * @module
 */
import { Effect, Number, Option, Schema } from "effect"
import * as Response from "effect/ai/Response"
import { Id } from "./Module.js"
import { Payload } from "./Payload.js"

/** Predictor invocation identity, shared by its parse attempts and selection.
 * @since 1.0.0
 * @category schemas
 */
export const Execution = {
  Id: Schema.String.pipe(Schema.brand("@scenesystems/effect-dsp/Trace/Execution/Id"))
}

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
  parseError: Schema.toCodecJson(Schema.Option(Schema.String)),
  toolCallCount: Schema.Finite,
  toolResultCount: Schema.Finite
})

/**
 * Captures a successful module invocation or one ReAct iteration.
 *
 * @remarks
 * Input and decoded answers are schema-encoded JSON documents; use
 * `Payload.decode` with the invocation's signature to recover typed values.
 * Intermediate ReAct output uses {@link UnparsedOutput}. Prompt and raw response
 * data are retained verbatim. For successful invocations, usage
 * is the final successful invocation's selected native usage, not a retry total.
 * Provider observation takes precedence over returned-response usage wholesale.
 *
 * @since 0.1.0
 * @category models
 */
export class Entry extends Schema.Class<Entry>("@scenesystems/effect-dsp/Trace/Entry")({
  /** Predictor invocation shared with its attempts. */
  execution: Execution.Id,
  /** Invoked module name. */
  moduleName: Schema.String,
  /** Description from the module signature. */
  signatureDescription: Schema.String,
  /** Schema-encoded input document, decoded with the input signature. */
  input: Payload,
  /** Schema-encoded answer or intermediate {@link UnparsedOutput} document. */
  output: Payload,
  /** Intermediate ReAct turns are evidence, not replayable demonstrations. */
  outcome: Schema.Literals(["completed", "intermediate"]).pipe(
    Schema.withDecodingDefaultType(Effect.succeed("completed"))
  ),
  /** Rendered prompt sent to the language model. */
  prompt: Schema.String,
  /** Unparsed language-model response text. */
  rawResponse: Schema.String,
  /** Same selected native usage as the final successful invocation's Call. */
  usage: Response.Usage,
  /** Invocation duration in milliseconds. */
  durationMs: Schema.Finite,
  /** Optional score assigned to this invocation. */
  score: Schema.toCodecJson(Schema.Option(Schema.Finite)),
  /** Invocation timestamp in Unix epoch milliseconds. */
  timestamp: Schema.Finite
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
export class Call extends Schema.Class<Call>("@scenesystems/effect-dsp/Trace/Call")({
  /** Language-model operation observed by the DSP runtime. */
  operation: Schema.Literals(["generateObject", "generateText"]),
  /** Provider usage when it was observed before the invocation terminated. */
  usage: Schema.toCodecJson(Schema.Option(Response.Usage)),
  /** Terminal invocation outcome without failure details. */
  outcome: Schema.Literals(["success", "failure", "interrupted"]),
  /** Invocation duration in milliseconds. */
  durationMs: Schema.Finite,
  /** Invocation completion time in Unix epoch milliseconds. */
  timestamp: Schema.Finite
}) {}

/**
 * Absent score used when an invocation has not been evaluated.
 *
 * @since 0.1.0
 * @category constants
 */
export const noScore: Option.Option<number> = Option.none()

/** Accumulated native provider usage and observed call count.
 * @since 0.1.0
 * @category models
 */
export class Usage extends Schema.Class<Usage>("@scenesystems/effect-dsp/Trace/Usage")({
  tokens: Response.Usage,
  callCount: Schema.Int
}) {}

/** One parsed or unparsed response within a predictor invocation.
 * @since 1.0.0
 * @category models
 */
export class Attempt extends Schema.Class<Attempt>("@scenesystems/effect-dsp/Trace/Attempt")({
  execution: Execution.Id,
  rawResponse: Schema.String,
  parseError: Schema.Option(Schema.String),
  /** Failed parse/tool-turn evidence; absent for a parsed answer. */
  unparsed: Schema.Option(UnparsedOutput),
  usage: Response.Usage
}) {}

/** Selected executions, all observed attempts and aggregate provider usage.
 * @since 1.0.0
 * @category models
 */
export class Program extends Schema.Class<Program>("@scenesystems/effect-dsp/Trace/Program")({
  selected: Schema.Chunk(Entry),
  attempts: Schema.Chunk(Attempt),
  usage: Usage
}) {}

const sumCounter = (current: Option.Option<number>, sample: Option.Option<number>): Option.Option<number> =>
  Option.match(current, {
    onNone: () => Option.none<number>(),
    onSome: (current) =>
      Option.match(sample, {
        onNone: () => Option.none<number>(),
        onSome: (sample) => Option.some(Number.sum(current, sample))
      })
  })

const accumulateTokens = (current: Response.Usage, sample: Option.Option<Response.Usage>): Response.Usage => {
  return new Response.Usage({
    inputTokens: {
      ...Option.match(
        sumCounter(
          Option.fromNullishOr(current.inputTokens.total),
          Option.flatMap(sample, (usage) => Option.fromNullishOr(usage.inputTokens.total))
        ),
        { onNone: () => ({}), onSome: (total) => ({ total }) }
      ),
      ...Option.match(
        sumCounter(
          Option.fromNullishOr(current.inputTokens.uncached),
          Option.flatMap(sample, (usage) => Option.fromNullishOr(usage.inputTokens.uncached))
        ),
        { onNone: () => ({}), onSome: (uncached) => ({ uncached }) }
      ),
      ...Option.match(
        sumCounter(
          Option.fromNullishOr(current.inputTokens.cacheRead),
          Option.flatMap(sample, (usage) => Option.fromNullishOr(usage.inputTokens.cacheRead))
        ),
        { onNone: () => ({}), onSome: (cacheRead) => ({ cacheRead }) }
      ),
      ...Option.match(
        sumCounter(
          Option.fromNullishOr(current.inputTokens.cacheWrite),
          Option.flatMap(sample, (usage) => Option.fromNullishOr(usage.inputTokens.cacheWrite))
        ),
        { onNone: () => ({}), onSome: (cacheWrite) => ({ cacheWrite }) }
      )
    },
    outputTokens: {
      ...Option.match(
        sumCounter(
          Option.fromNullishOr(current.outputTokens.total),
          Option.flatMap(sample, (usage) => Option.fromNullishOr(usage.outputTokens.total))
        ),
        { onNone: () => ({}), onSome: (total) => ({ total }) }
      ),
      ...Option.match(
        sumCounter(
          Option.fromNullishOr(current.outputTokens.text),
          Option.flatMap(sample, (usage) => Option.fromNullishOr(usage.outputTokens.text))
        ),
        { onNone: () => ({}), onSome: (text) => ({ text }) }
      ),
      ...Option.match(
        sumCounter(
          Option.fromNullishOr(current.outputTokens.reasoning),
          Option.flatMap(sample, (usage) => Option.fromNullishOr(usage.outputTokens.reasoning))
        ),
        { onNone: () => ({}), onSome: (reasoning) => ({ reasoning }) }
      )
    }
  })
}

/** Adds one optional provider usage report to an aggregate.
 * @since 0.1.0
 * @category combinators
 */
export const accumulateUsage = (summary: Usage, sample: Option.Option<Response.Usage>): Usage =>
  new Usage({
    tokens: accumulateTokens(summary.tokens, sample),
    callCount: Number.increment(summary.callCount)
  })

/** Known-zero usage before any call is observed.
 * @since 0.1.0
 * @category constants
 */
export const emptyUsage = new Usage({
  tokens: new Response.Usage({
    inputTokens: { total: 0, uncached: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0, reasoning: 0 }
  }),
  callCount: 0
})

/** Optimizer-facing projection of one trace entry.
 * @since 0.1.0
 * @category models
 */
export class ObjectiveProjection
  extends Schema.Class<ObjectiveProjection>("@scenesystems/effect-dsp/Trace/ObjectiveProjection")({
    moduleId: Schema.suspend(() => Id),
    signatureDescription: Schema.String,
    input: Payload,
    prompt: Schema.String,
    output: Payload,
    outcome: Entry.fields.outcome,
    score: Schema.toCodecJson(Schema.Option(Schema.Finite)),
    rawResponse: Schema.String,
    usage: Response.Usage,
    durationMs: Schema.Finite,
    timestamp: Schema.Finite
  })
{}

/** Projects a trace entry into validated optimizer evidence.
 * @since 0.1.0
 * @category combinators
 */
export const projectObjective = (
  entry: Entry
): Effect.Effect<ObjectiveProjection, Schema.SchemaError> =>
  Schema.decodeEffect(Id)(entry.moduleName).pipe(
    Effect.map((moduleId) =>
      new ObjectiveProjection({
        moduleId,
        signatureDescription: entry.signatureDescription,
        input: entry.input,
        prompt: entry.prompt,
        output: entry.output,
        outcome: entry.outcome,
        score: entry.score,
        rawResponse: entry.rawResponse,
        usage: entry.usage,
        durationMs: entry.durationMs,
        timestamp: entry.timestamp
      })
    )
  )

export { append, appendCall } from "./internal/trace/append.js"
export { observeUsage } from "./internal/trace/call.js"
export { get, getCalls, getUsage, withCalls, withTracing, withUsageTracking } from "./internal/trace/scope.js"
