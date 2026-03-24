/**
 * Reusable optimizer progress and summary abstractions.
 *
 * @since 0.0.0
 */
import { Effect } from "effect"
import {
  type BootstrapProgressSink,
  formatBootstrapProgressEvent,
  summarizeBootstrapEvents,
  tapBootstrapProgress
} from "../optimizers/BootstrapFewShot/progress.js"
import {
  formatGEPAProgressEvent,
  type GEPAEventSummary,
  type GEPAProgressSink,
  summarizeGEPAEvents,
  tapGEPAProgress
} from "../optimizers/GEPA/progress.js"
import { summarizeMIPROv2OptimizationObservability } from "../optimizers/MIPROv2/observability.js"
import {
  formatMIPROv2ProgressEvent,
  type MIPROv2EventSummary,
  type MIPROv2ProgressSink,
  summarizeMIPROv2Events,
  tapMIPROv2Progress
} from "../optimizers/MIPROv2/progress.js"

/**
 * Format one MIPROv2 event for deterministic progress logging.
 *
 * @since 0.0.0
 * @category formatters
 */
export const formatMIPROv2Event = formatMIPROv2ProgressEvent

/**
 * Format one BootstrapFewShot event for deterministic progress logging.
 *
 * @since 0.0.0
 * @category formatters
 */
export const formatBootstrapEvent = formatBootstrapProgressEvent

/**
 * Format one GEPA event for deterministic progress logging.
 *
 * @since 0.0.0
 * @category formatters
 */
export const formatGEPAEvent = formatGEPAProgressEvent

export {
  /**
   * Summarize MIPROv2 events into a semantic outcome report.
   *
   * @since 0.0.0
   * @category combinators
   */
  summarizeMIPROv2Events,
  /**
   * Tap formatted MIPROv2 progress lines from a MIPROv2 stream.
   *
   * @since 0.0.0
   * @category combinators
   */
  tapMIPROv2Progress
} from "../optimizers/MIPROv2/progress.js"

export {
  /**
   * Summarize BootstrapFewShot events into a semantic outcome report.
   *
   * @since 0.0.0
   * @category combinators
   */
  summarizeBootstrapEvents,
  /**
   * Tap formatted BootstrapFewShot progress lines from a BootstrapFewShot stream.
   *
   * @since 0.0.0
   * @category combinators
   */
  tapBootstrapProgress
} from "../optimizers/BootstrapFewShot/progress.js"

export {
  /**
   * Summarize GEPA events into a semantic outcome report.
   *
   * @since 0.0.0
   * @category combinators
   */
  summarizeGEPAEvents,
  /**
   * Tap formatted GEPA progress lines from a GEPA stream.
   *
   * @since 0.0.0
   * @category combinators
   */
  tapGEPAProgress
} from "../optimizers/GEPA/progress.js"

/**
 * Semantic summary of a MIPROv2 optimization run — baseline vs. optimized
 * scores, demo counts, and per-event breakdown.
 *
 * @since 0.0.0
 * @category models
 */
export type MIPROv2OutcomeSummary = Readonly<{
  readonly baselineExactMatch: number
  readonly optimizedExactMatch: number
  readonly scoreDelta: number
  readonly demoCountBeforeOptimization: number
  readonly demoCountAfterOptimization: number
  readonly demosLearnedDuringMIPROv2: number
  readonly eventSummary: MIPROv2EventSummary
}>

/**
 * Semantic summary of a GEPA optimization run — baseline vs. optimized scores,
 * instruction changes, and per-event breakdown.
 *
 * @since 0.0.0
 * @category models
 */
export type GEPAOutcomeSummary = Readonly<{
  readonly baselineExactMatch: number
  readonly optimizedExactMatch: number
  readonly scoreDelta: number
  readonly instructionChanged: boolean
  readonly instructionLengthBeforeOptimization: number
  readonly instructionLengthAfterOptimization: number
  readonly eventSummary: GEPAEventSummary
}>

/**
 * Build a semantic MIPROv2 outcome summary for live and test workloads.
 *
 * @since 0.0.0
 * @category constructors
 */
export const summarizeMIPROv2Outcome = (options: {
  readonly baselineExactMatch: number
  readonly optimizedExactMatch: number
  readonly demoCountBeforeOptimization: number
  readonly demoCountAfterOptimization: number
  readonly eventSummary: MIPROv2EventSummary
}): MIPROv2OutcomeSummary => ({
  baselineExactMatch: options.baselineExactMatch,
  optimizedExactMatch: options.optimizedExactMatch,
  scoreDelta: options.optimizedExactMatch - options.baselineExactMatch,
  demoCountBeforeOptimization: options.demoCountBeforeOptimization,
  demoCountAfterOptimization: options.demoCountAfterOptimization,
  demosLearnedDuringMIPROv2: options.demoCountAfterOptimization - options.demoCountBeforeOptimization,
  eventSummary: options.eventSummary
})

/**
 * Build a semantic GEPA outcome summary for live and test workloads.
 *
 * @since 0.0.0
 * @category constructors
 */
export const summarizeGEPAOutcome = (options: {
  readonly baselineExactMatch: number
  readonly optimizedExactMatch: number
  readonly instructionBeforeOptimization: string
  readonly instructionAfterOptimization: string
  readonly eventSummary: GEPAEventSummary
}): GEPAOutcomeSummary => ({
  baselineExactMatch: options.baselineExactMatch,
  optimizedExactMatch: options.optimizedExactMatch,
  scoreDelta: options.optimizedExactMatch - options.baselineExactMatch,
  instructionChanged: options.instructionAfterOptimization !== options.instructionBeforeOptimization,
  instructionLengthBeforeOptimization: options.instructionBeforeOptimization.length,
  instructionLengthAfterOptimization: options.instructionAfterOptimization.length,
  eventSummary: options.eventSummary
})

/**
 * Canonical optimizer progress API — formatters, tap combinators, and summary
 * builders for all optimizer variants.
 *
 * @since 0.0.0
 * @category constructors
 */
export const progress = {
  formatBootstrapEvent,
  tapBootstrapProgress,
  summarizeBootstrapEvents,
  formatMIPROv2Event,
  tapMIPROv2Progress,
  summarizeMIPROv2Events,
  summarizeMIPROv2Outcome,
  summarizeMIPROv2OptimizationObservability,
  formatGEPAEvent,
  tapGEPAProgress,
  summarizeGEPAEvents,
  summarizeGEPAOutcome
}

export {
  /**
   * MIPROv2 optimization observability snapshot.
   *
   * @since 0.0.0
   * @category models
   */
  type MIPROv2OptimizationObservability
} from "../optimizers/MIPROv2/observability.js"

export {
  /**
   * MIPROv2 formatted progress line.
   *
   * @since 0.0.0
   * @category models
   */
  type MIPROv2ProgressLine,
  /**
   * MIPROv2 progress sink callback.
   *
   * @since 0.0.0
   * @category models
   */
  type MIPROv2ProgressSink
} from "../optimizers/MIPROv2/progress.js"

export {
  /**
   * BootstrapFewShot event summary.
   *
   * @since 0.0.0
   * @category models
   */
  type BootstrapEventSummary,
  /**
   * BootstrapFewShot formatted progress line.
   *
   * @since 0.0.0
   * @category models
   */
  type BootstrapProgressLine,
  /**
   * BootstrapFewShot progress sink callback.
   *
   * @since 0.0.0
   * @category models
   */
  type BootstrapProgressSink
} from "../optimizers/BootstrapFewShot/progress.js"

export {
  /**
   * GEPA formatted progress line.
   *
   * @since 0.0.0
   * @category models
   */
  type GEPAProgressLine,
  /**
   * GEPA progress sink callback.
   *
   * @since 0.0.0
   * @category models
   */
  type GEPAProgressSink
} from "../optimizers/GEPA/progress.js"

const noOpProgressEffect = Effect.void

/**
 * No-op progress sink for BootstrapFewShot streams.
 *
 * @since 0.0.0
 * @category constants
 */
export const noBootstrapProgress: BootstrapProgressSink = () => noOpProgressEffect

/**
 * No-op progress sink for MIPROv2 streams.
 *
 * @since 0.0.0
 * @category constants
 */
export const noMIPROv2Progress: MIPROv2ProgressSink = () => noOpProgressEffect

/**
 * No-op progress sink for GEPA streams.
 *
 * @since 0.0.0
 * @category constants
 */
export const noGEPAProgress: GEPAProgressSink = () => noOpProgressEffect
