/**
 * Noun-owned optimizer summary and observability projections.
 *
 * @since 0.2.0
 */
import { Data } from "effect"
import type { GEPAEventSummary } from "../optimizers/GEPA/progress.js"
import type { MIPROv2EventSummary } from "../optimizers/MIPROv2/progress.js"

/**
 * MIPROv2 search-quality and retained-gain observability projections.
 *
 * @since 0.2.0
 */
export * from "../optimizers/MIPROv2/observability.js"

/**
 * Semantic summary of a MIPROv2 optimization run — baseline vs. optimized
 * scores, demo counts, and per-event breakdown.
 *
 * @since 0.2.0
 * @category models
 */
export class MIPROv2OutcomeSummary extends Data.Class<{
  readonly baselineExactMatch: number
  readonly optimizedExactMatch: number
  readonly scoreDelta: number
  readonly demoCountBeforeOptimization: number
  readonly demoCountAfterOptimization: number
  readonly demosLearnedDuringMIPROv2: number
  readonly eventSummary: MIPROv2EventSummary
}> {
  static make = (options: {
    readonly baselineExactMatch: number
    readonly optimizedExactMatch: number
    readonly demoCountBeforeOptimization: number
    readonly demoCountAfterOptimization: number
    readonly eventSummary: MIPROv2EventSummary
  }): MIPROv2OutcomeSummary =>
    new MIPROv2OutcomeSummary({
      baselineExactMatch: options.baselineExactMatch,
      optimizedExactMatch: options.optimizedExactMatch,
      scoreDelta: options.optimizedExactMatch - options.baselineExactMatch,
      demoCountBeforeOptimization: options.demoCountBeforeOptimization,
      demoCountAfterOptimization: options.demoCountAfterOptimization,
      demosLearnedDuringMIPROv2: options.demoCountAfterOptimization - options.demoCountBeforeOptimization,
      eventSummary: options.eventSummary
    })
}

/**
 * Semantic summary of a GEPA optimization run — baseline vs. optimized scores,
 * instruction changes, and per-event breakdown.
 *
 * @since 0.2.0
 * @category models
 */
export class GEPAOutcomeSummary extends Data.Class<{
  readonly baselineExactMatch: number
  readonly optimizedExactMatch: number
  readonly scoreDelta: number
  readonly instructionChanged: boolean
  readonly instructionLengthBeforeOptimization: number
  readonly instructionLengthAfterOptimization: number
  readonly eventSummary: GEPAEventSummary
}> {
  static make = (options: {
    readonly baselineExactMatch: number
    readonly optimizedExactMatch: number
    readonly instructionBeforeOptimization: string
    readonly instructionAfterOptimization: string
    readonly eventSummary: GEPAEventSummary
  }): GEPAOutcomeSummary =>
    new GEPAOutcomeSummary({
      baselineExactMatch: options.baselineExactMatch,
      optimizedExactMatch: options.optimizedExactMatch,
      scoreDelta: options.optimizedExactMatch - options.baselineExactMatch,
      instructionChanged: options.instructionAfterOptimization !== options.instructionBeforeOptimization,
      instructionLengthBeforeOptimization: options.instructionBeforeOptimization.length,
      instructionLengthAfterOptimization: options.instructionAfterOptimization.length,
      eventSummary: options.eventSummary
    })
}
