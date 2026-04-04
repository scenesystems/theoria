/**
 * MIPROv2 observability — search quality and retained gain projections for
 * diagnostic reporting.
 *
 * @since 0.1.0
 */
import type { MIPROv2EventSummary } from "./progress.js"

/**
 * Semantic decomposition of MIPROv2 search quality versus retained gain.
 *
 * `searchGain` captures best trial quality above baseline. `retainedGain`
 * captures end-state quality above baseline after optimization is applied.
 *
 * @since 0.1.0
 * @category models
 */
export type MIPROv2OptimizationObservability = Readonly<{
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly searchBestScoreSeen: boolean
  readonly searchBestScore: number
  readonly searchGain: number
  readonly retainedGain: number
  readonly retainedVsSearchGap: number
  readonly searchImprovedButRetainedFlat: boolean
}>

/**
 * Build semantic MIPROv2 search observability from baseline/evaluation and
 * event-derived phase-3 best-trial signals.
 *
 * @since 0.1.0
 * @category constructors
 */
export const summarizeMIPROv2OptimizationObservability = (options: {
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly eventSummary: MIPROv2EventSummary
}): MIPROv2OptimizationObservability => {
  const searchBestScore = options.eventSummary.phase3BestScoreSeen
    ? options.eventSummary.phase3BestScore
    : options.optimizedScore
  const searchGain = searchBestScore - options.baselineScore
  const retainedGain = options.optimizedScore - options.baselineScore
  const retainedVsSearchGap = searchBestScore - options.optimizedScore

  return {
    baselineScore: options.baselineScore,
    optimizedScore: options.optimizedScore,
    searchBestScoreSeen: options.eventSummary.phase3BestScoreSeen,
    searchBestScore,
    searchGain,
    retainedGain,
    retainedVsSearchGap,
    searchImprovedButRetainedFlat: searchGain > 0 && retainedGain <= 0
  }
}
