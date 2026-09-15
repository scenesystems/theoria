/**
 * Canonical provider token usage accumulated across model calls.
 *
 * @since 0.1.0
 */
import * as Response from "@effect/ai/Response"
import { Number, Option, Schema } from "effect"

/**
 * Accumulates native provider usage and the number of observed calls.
 *
 * @remarks
 * Each token counter remains independently unknown when any accumulated call
 * omits that counter. `totalTokens` is never inferred from other counters.
 *
 * @since 0.1.0
 * @category models
 */
export class Usage extends Schema.Class<Usage>("Usage")({
  /** Independently accumulated native provider counters. */
  tokens: Response.Usage,
  /** Number of calls represented by the aggregate. */
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
): Option.Option<number> =>
  Option.zipWith(
    Option.fromNullable(current),
    sampleCounter(sample, select),
    Number.sum
  )

const accumulateTokens = (
  current: Response.Usage,
  sample: Option.Option<Response.Usage>
): Response.Usage => {
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

/**
 * Adds one optional provider usage report to an aggregate.
 *
 * @remarks
 * Every sample increments `callCount`, including a call with no usage report.
 * A missing report makes every counter unknown. A partially reported sample
 * makes only its omitted counters unknown, and an unknown counter stays unknown.
 *
 * @param summary - Aggregate before the observed call.
 * @param sample - Native provider usage, when the call reported it.
 * @returns A new immutable aggregate.
 *
 * @since 0.1.0
 * @category combinators
 */
export const accumulateUsage = (
  summary: Usage,
  sample: Option.Option<Response.Usage>
): Usage =>
  new Usage({
    tokens: accumulateTokens(summary.tokens, sample),
    callCount: Number.increment(summary.callCount)
  })

/**
 * Five known zero counters with no observed calls.
 *
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
