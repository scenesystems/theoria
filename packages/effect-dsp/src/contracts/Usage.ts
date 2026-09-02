/**
 * Token and LM-call accounting accumulated across module forward passes.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * Accumulates provider token counts and model-call counts across invocations.
 *
 * @remarks
 * Cached calls remain part of `callCount` and are counted separately in
 * `cachedCount`. The schema applies no integer, sign, or finiteness constraints.
 *
 * @since 0.1.0
 * @category models
 */
export class Usage extends Schema.Class<Usage>("Usage")({
  /** Sum of reported input tokens; absent sample values contribute zero. */
  inputTokens: Schema.Number,
  /** Sum of reported output tokens; absent sample values contribute zero. */
  outputTokens: Schema.Number,
  /** Number of accumulated samples. */
  callCount: Schema.Number,
  /** Number of accumulated samples marked as cache hits. */
  cachedCount: Schema.Number
}) {}

/**
 * Captures provider token counts and cache status for one model call.
 *
 * @remarks
 * Token counts remain absent when the provider does not report them. The schema
 * does not validate reported counts as non-negative integers.
 *
 * @since 0.1.0
 * @category models
 */
export class UsageSample extends Schema.Class<UsageSample>("UsageSample")({
  /** Provider-reported input tokens, when available. */
  inputTokens: Schema.OptionFromSelf(Schema.Number),
  /** Provider-reported output tokens, when available. */
  outputTokens: Schema.OptionFromSelf(Schema.Number),
  /** Whether the response came from the configured cache. */
  cached: Schema.Boolean
}) {}

const tokenCount = (value: Option.Option<number>): number => Option.getOrElse(value, () => 0)

/**
 * Adds one model-call sample to cumulative usage.
 *
 * @remarks
 * Absent token counts add zero, every sample increments `callCount`, and cached
 * samples increment `cachedCount`. The input value is not mutated.
 *
 * @param usage - Totals before the call.
 * @param sample - Token counts and cache status for the call.
 * @returns New totals after the sample.
 *
 * @since 0.1.0
 * @category combinators
 */
export const accumulateUsage = (
  usage: Usage,
  sample: UsageSample
): Usage =>
  new Usage({
    inputTokens: usage.inputTokens + tokenCount(sample.inputTokens),
    outputTokens: usage.outputTokens + tokenCount(sample.outputTokens),
    callCount: usage.callCount + 1,
    cachedCount: usage.cachedCount + (sample.cached ? 1 : 0)
  })

/**
 * Subtracts an earlier usage snapshot from a later snapshot.
 *
 * @remarks
 * No ordering invariant is checked, so any component can be negative when the
 * `after` value is smaller.
 *
 * @param options - Snapshots to subtract component by component.
 * @returns A new usage value equal to `after - before` for every field.
 *
 * @since 0.1.0
 * @category combinators
 */
export const usageDelta = (options: {
  readonly before: Usage
  readonly after: Usage
}): Usage =>
  new Usage({
    inputTokens: options.after.inputTokens - options.before.inputTokens,
    outputTokens: options.after.outputTokens - options.before.outputTokens,
    callCount: options.after.callCount - options.before.callCount,
    cachedCount: options.after.cachedCount - options.before.cachedCount
  })

/**
 * Zero-valued seed for {@link accumulateUsage}.
 *
 * @since 0.1.0
 * @category constants
 */
export const emptyUsage = new Usage({
  inputTokens: 0,
  outputTokens: 0,
  callCount: 0,
  cachedCount: 0
})
