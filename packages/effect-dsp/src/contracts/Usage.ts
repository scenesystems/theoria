/**
 * Token and LM-call accounting accumulated across module forward passes.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * Running totals of input/output tokens and LM call counts accumulated
 * across one or more module forward passes. Separates cached calls from
 * fresh calls so optimizers can reason about cost independently from latency.
 *
 * @see {@link UsageSample} — per-call snapshot folded into Usage via {@link Usage.accumulate}
 * @see {@link Usage.empty} — zero-valued seed for accumulation
 *
 * @since 0.1.0
 * @category models
 */
export class Usage extends Schema.Class<Usage>("Usage")({
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  callCount: Schema.Number,
  cachedCount: Schema.Number
}) {
  /**
   * Zero-valued {@link Usage} seed — the identity element for
   * {@link Usage.accumulate} folding.
   *
   * @since 0.1.0
   * @category constants
   */
  static readonly empty = Usage.make({
    inputTokens: 0,
    outputTokens: 0,
    callCount: 0,
    cachedCount: 0
  })

  /**
   * Fold a single-call {@link UsageSample} into running {@link Usage} totals.
   * Treats `None` token counts as zero.
   *
   * @since 0.1.0
   * @category combinators
   */
  static accumulate(usage: Usage, sample: UsageSample): Usage {
    return Usage.make({
      inputTokens: usage.inputTokens + tokenCount(sample.inputTokens),
      outputTokens: usage.outputTokens + tokenCount(sample.outputTokens),
      callCount: usage.callCount + 1,
      cachedCount: usage.cachedCount + (sample.cached ? 1 : 0)
    })
  }

  /**
   * Compute the element-wise difference between two {@link Usage} snapshots.
   * Useful for measuring cost of a single optimization trial by subtracting
   * the before-snapshot from the after-snapshot.
   *
   * @since 0.1.0
   * @category combinators
   */
  static delta(options: {
    readonly before: Usage
    readonly after: Usage
  }): Usage {
    return Usage.make({
      inputTokens: options.after.inputTokens - options.before.inputTokens,
      outputTokens: options.after.outputTokens - options.before.outputTokens,
      callCount: options.after.callCount - options.before.callCount,
      cachedCount: options.after.cachedCount - options.before.cachedCount
    })
  }
}

/**
 * Single-call usage snapshot emitted by the forward runtime. Token counts
 * are `Option` because not all providers return them (e.g. streaming without
 * final usage headers). `cached` indicates whether the response was served
 * from the memoization layer rather than a fresh LM call.
 *
 * @see {@link Usage} — accumulated totals built from UsageSample values
 * @see {@link Usage.accumulate} — folds a sample into running totals
 *
 * @since 0.1.0
 * @category models
 */
export class UsageSample extends Schema.Class<UsageSample>("UsageSample")({
  inputTokens: Schema.OptionFromSelf(Schema.Number),
  outputTokens: Schema.OptionFromSelf(Schema.Number),
  cached: Schema.Boolean
}) {}

const tokenCount = (value: Option.Option<number>): number => Option.getOrElse(value, () => 0)
