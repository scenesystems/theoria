/**
 * MIPROv2 observability — search quality and retained gain projections for
 * diagnostic reporting.
 *
 * @since 0.1.0
 */
import { Data } from "effect"
import type { MIPROv2EventSummary } from "./progress.js"

/**
 * Semantic decomposition of MIPROv2 search quality versus retained gain.
 *
 * `searchGain` captures best trial quality above baseline. `retainedGain`
 * captures end-state quality above baseline after optimization is applied.
 *
 * @since 0.2.0
 * @category models
 */
export class MIPROv2OptimizationObservability extends Data.Class<{
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly searchBestScoreSeen: boolean
  readonly searchBestScore: number
  readonly searchGain: number
  readonly retainedGain: number
  readonly retainedVsSearchGap: number
  readonly searchImprovedButRetainedFlat: boolean
}> {
  static make = (options: {
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

    return new MIPROv2OptimizationObservability({
      baselineScore: options.baselineScore,
      optimizedScore: options.optimizedScore,
      searchBestScoreSeen: options.eventSummary.phase3BestScoreSeen,
      searchBestScore,
      searchGain,
      retainedGain,
      retainedVsSearchGap,
      searchImprovedButRetainedFlat: searchGain > 0 && retainedGain <= 0
    })
  }
}
