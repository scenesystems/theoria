/**
 * Serializable records captured from model invocations.
 *
 * @since 0.1.0
 * @module
 */
import * as Response from "@effect/ai/Response"
import type { ParseResult } from "effect"
import { Effect, Number, Option, Schema } from "effect"
import { Id } from "./Module.js"
import { Payload } from "./Payload.js"

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
export class Call extends Schema.Class<Call>("@scenesystems/effect-dsp/Trace/Call")({
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

/** Accumulated native provider usage and observed call count.
 * @since 0.1.0
 * @category models
 */
export class Usage extends Schema.Class<Usage>("@scenesystems/effect-dsp/Trace/Usage")({
  tokens: Response.Usage,
  callCount: Schema.NonNegativeInt
}) {}

const sampleCounter = (
  sample: Option.Option<Response.Usage>,
  select: (usage: Response.Usage) => Response.Usage["inputTokens"]
): Option.Option<number> => Option.flatMap(sample, (usage) => Option.fromNullable(select(usage)))

const sumCounter = (
  current: Response.Usage["inputTokens"],
  sample: Option.Option<Response.Usage>,
  select: (usage: Response.Usage) => Response.Usage["inputTokens"]
): Option.Option<number> => Option.zipWith(Option.fromNullable(current), sampleCounter(sample, select), Number.sum)

const accumulateTokens = (current: Response.Usage, sample: Option.Option<Response.Usage>): Response.Usage => {
  const inputTokens = sumCounter(current.inputTokens, sample, (usage) => usage.inputTokens)
  const outputTokens = sumCounter(current.outputTokens, sample, (usage) => usage.outputTokens)
  const totalTokens = sumCounter(current.totalTokens, sample, (usage) => usage.totalTokens)
  const reasoningTokens = sumCounter(current.reasoningTokens, sample, (usage) => usage.reasoningTokens)
  const cachedInputTokens = sumCounter(current.cachedInputTokens, sample, (usage) => usage.cachedInputTokens)

  return new Response.Usage({
    ...Option.match(inputTokens, {
      onNone: () => ({ inputTokens: undefined }),
      onSome: (value) => ({ inputTokens: value })
    }),
    ...Option.match(outputTokens, {
      onNone: () => ({ outputTokens: undefined }),
      onSome: (value) => ({ outputTokens: value })
    }),
    ...Option.match(totalTokens, {
      onNone: () => ({ totalTokens: undefined }),
      onSome: (value) => ({ totalTokens: value })
    }),
    ...Option.match(reasoningTokens, {
      onNone: () => ({}),
      onSome: (value) => ({ reasoningTokens: value })
    }),
    ...Option.match(cachedInputTokens, {
      onNone: () => ({}),
      onSome: (value) => ({ cachedInputTokens: value })
    })
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
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0
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
    score: Schema.Option(Schema.Number),
    rawResponse: Schema.String,
    usage: Response.Usage,
    durationMs: Schema.Number,
    timestamp: Schema.Number
  })
{}

/** Projects a trace entry into validated optimizer evidence.
 * @since 0.1.0
 * @category combinators
 */
export const projectObjective = (
  entry: Entry
): Effect.Effect<ObjectiveProjection, ParseResult.ParseError> =>
  Schema.decode(Id)(entry.moduleName).pipe(
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
