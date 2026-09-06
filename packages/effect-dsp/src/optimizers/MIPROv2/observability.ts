/**
 * Projects search and retained scores relative to a caller-supplied baseline.
 *
 * @since 0.1.0
 */
import { Data } from "effect"
import type { MIPROv2EventSummary } from "./progress.js"

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
export class MIPROv2OptimizationObservability extends Data.Class<{
  /** Reference score supplied by the caller. */
  readonly baselineScore: number
  /** Caller-evaluated score for the retained module state. */
  readonly optimizedScore: number
  /** Whether the event summary contained any Phase 3 score. */
  readonly searchBestScoreSeen: boolean
  /** Best event-derived score, or `optimizedScore` when none was observed. */
  readonly searchBestScore: number
  /** `searchBestScore - baselineScore`. */
  readonly searchGain: number
  /** `optimizedScore - baselineScore`. */
  readonly retainedGain: number
  /** `searchBestScore - optimizedScore`. */
  readonly retainedVsSearchGap: number
  /** True when search gain is positive and retained gain is zero or negative. */
  readonly searchImprovedButRetainedFlat: boolean
}> {}

/**
 * Computes score differences from event-derived and caller-evaluated values.
 *
 * @param options - Baseline score, retained score, and completed event summary.
 * @returns A pure projection that preserves the supplied scores.
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
