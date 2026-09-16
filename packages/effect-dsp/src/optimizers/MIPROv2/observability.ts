/**
 * Projects search and retained scores relative to a caller-supplied baseline.
 *
 * @since 0.1.0
 */
import { Boolean as Bool, Number as Num, Schema } from "effect"
import { MIPROv2EventSummary } from "./progress.js"

/**
 * Compares the best reported search score with a separately evaluated final module.
 *
 * @remarks
 * When the event summary has no Phase 3 score, `searchBestScore` falls back to
 * `optimizedScore`. All gain and gap fields are arithmetic differences; this
 * type does not validate score scale or metric comparability.
 *
 * @since 0.1.0
 * @category models
 */
export class MIPROv2OptimizationObservability
  extends Schema.Class<MIPROv2OptimizationObservability>("MIPROv2OptimizationObservability")({
    /** Reference score supplied by the caller. */
    baselineScore: Schema.Number,
    /** Caller-evaluated score for the retained module state. */
    optimizedScore: Schema.Number,
    /** Whether the event summary contained any Phase 3 score. */
    searchBestScoreSeen: Schema.Boolean,
    /** Best event-derived score, or `optimizedScore` when none was observed. */
    searchBestScore: Schema.Number,
    /** `searchBestScore - baselineScore`. */
    searchGain: Schema.Number,
    /** `optimizedScore - baselineScore`. */
    retainedGain: Schema.Number,
    /** `searchBestScore - optimizedScore`. */
    retainedVsSearchGap: Schema.Number,
    /** True when search gain is positive and retained gain is zero or negative. */
    searchImprovedButRetainedFlat: Schema.Boolean
  })
{}

/**
 * Supplies baseline, retained, and event-derived scores for observability projection.
 *
 * @since 0.1.0
 * @category models
 */
export class MIPROv2OptimizationObservabilityOptions extends Schema.Class<MIPROv2OptimizationObservabilityOptions>(
  "MIPROv2OptimizationObservabilityOptions"
)({
  /** Reference score supplied by the caller. */
  baselineScore: Schema.Number,
  /** Caller-evaluated score for the retained module state. */
  optimizedScore: Schema.Number,
  /** Independently folded MIPROv2 lifecycle events. */
  eventSummary: MIPROv2EventSummary
}) {}

/**
 * Computes score differences from event-derived and caller-evaluated values.
 *
 * @param options - Baseline score, retained score, and completed event summary.
 * @returns A pure projection that preserves the supplied scores.
 *
 * @since 0.1.0
 * @category constructors
 */
export const summarizeMIPROv2OptimizationObservability = (
  options: MIPROv2OptimizationObservabilityOptions
): MIPROv2OptimizationObservability => {
  const searchBestScore = Bool.match(options.eventSummary.phase3BestScoreSeen, {
    onFalse: () => options.optimizedScore,
    onTrue: () => options.eventSummary.phase3BestScore
  })
  const searchGain = Num.subtract(searchBestScore, options.baselineScore)
  const retainedGain = Num.subtract(options.optimizedScore, options.baselineScore)
  const retainedVsSearchGap = Num.subtract(searchBestScore, options.optimizedScore)

  return new MIPROv2OptimizationObservability({
    baselineScore: options.baselineScore,
    optimizedScore: options.optimizedScore,
    searchBestScoreSeen: options.eventSummary.phase3BestScoreSeen,
    searchBestScore,
    searchGain,
    retainedGain,
    retainedVsSearchGap,
    searchImprovedButRetainedFlat: Bool.and(
      Num.greaterThan(searchGain, 0),
      Num.lessThanOrEqualTo(retainedGain, 0)
    )
  })
}
