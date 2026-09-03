/**
 * Formats optimizer events and derives reports from recorded outcomes.
 *
 * @since 0.1.0
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
 * Formats a MIPROv2 event according to {@link formatMIPROv2ProgressEvent}.
 *
 * @since 0.1.0
 * @category formatters
 */
export const formatMIPROv2Event = formatMIPROv2ProgressEvent

/**
 * Formats a BootstrapFewShot event according to {@link formatBootstrapProgressEvent}.
 *
 * @since 0.1.0
 * @category formatters
 */
export const formatBootstrapEvent = formatBootstrapProgressEvent

/**
 * Formats a GEPA event as a tagged line with selected progress fields.
 *
 * @since 0.1.0
 * @category formatters
 */
export const formatGEPAEvent = formatGEPAProgressEvent

export { summarizeMIPROv2Events, tapMIPROv2Progress } from "../optimizers/MIPROv2/progress.js"

export { summarizeBootstrapEvents, tapBootstrapProgress } from "../optimizers/BootstrapFewShot/progress.js"

export { summarizeGEPAEvents, tapGEPAProgress } from "../optimizers/GEPA/progress.js"

/**
 * Compares caller-evaluated exact-match scores and demonstration counts.
 *
 * @remarks
 * Values are retained without range validation. Deltas may be negative, and
 * `eventSummary` is not checked against the supplied scores or counts.
 *
 * @since 0.1.0
 * @category models
 */
export type MIPROv2OutcomeSummary = Readonly<{
  /** Reference exact-match score supplied by the caller. */
  readonly baselineExactMatch: number
  /** Exact-match score supplied after optimization. */
  readonly optimizedExactMatch: number
  /** `optimizedExactMatch - baselineExactMatch`. */
  readonly scoreDelta: number
  /** Caller-observed demonstration count before optimization. */
  readonly demoCountBeforeOptimization: number
  /** Caller-observed demonstration count after optimization. */
  readonly demoCountAfterOptimization: number
  /** `demoCountAfterOptimization - demoCountBeforeOptimization`. */
  readonly demosLearnedDuringMIPROv2: number
  /** Independently folded lifecycle events. */
  readonly eventSummary: MIPROv2EventSummary
}>

/**
 * Compares caller-evaluated exact-match scores and instruction strings.
 *
 * @remarks
 * Values are retained without range validation. Instruction lengths use
 * JavaScript UTF-16 code units. `eventSummary` is not checked against the
 * supplied scores or instructions.
 *
 * @since 0.1.0
 * @category models
 */
export type GEPAOutcomeSummary = Readonly<{
  /** Reference exact-match score supplied by the caller. */
  readonly baselineExactMatch: number
  /** Exact-match score supplied after optimization. */
  readonly optimizedExactMatch: number
  /** `optimizedExactMatch - baselineExactMatch`. */
  readonly scoreDelta: number
  /** Whether the two supplied instruction strings differ by strict equality. */
  readonly instructionChanged: boolean
  /** UTF-16 code-unit count of the pre-optimization instruction. */
  readonly instructionLengthBeforeOptimization: number
  /** UTF-16 code-unit count of the post-optimization instruction. */
  readonly instructionLengthAfterOptimization: number
  /** Independently folded lifecycle events. */
  readonly eventSummary: GEPAEventSummary
}>

/**
 * Computes MIPROv2 score and demonstration deltas from supplied observations.
 *
 * @param options - Scores, counts, and an independently derived event summary.
 * @returns A new report retaining the supplied values.
 *
 * @since 0.1.0
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
 * Computes GEPA score delta and instruction comparison from supplied observations.
 *
 * @param options - Scores, instructions, and an independently derived event summary.
 * @returns A new report retaining the supplied values.
 *
 * @since 0.1.0
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
 * Groups progress formatting, stream taps, and outcome projections under one value.
 *
 * @since 0.1.0
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

export { type MIPROv2OptimizationObservability } from "../optimizers/MIPROv2/observability.js"

export { type MIPROv2ProgressLine, type MIPROv2ProgressSink } from "../optimizers/MIPROv2/progress.js"

export {
  type BootstrapEventSummary,
  type BootstrapProgressLine,
  type BootstrapProgressSink
} from "../optimizers/BootstrapFewShot/progress.js"

export { type GEPAProgressLine, type GEPAProgressSink } from "../optimizers/GEPA/progress.js"

const noOpProgressEffect = Effect.void

/**
 * Discards formatted bootstrap progress without adding Effect channels.
 *
 * @since 0.1.0
 * @category constants
 */
export const noBootstrapProgress: BootstrapProgressSink = () => noOpProgressEffect

/**
 * Discards formatted MIPROv2 progress without adding Effect channels.
 *
 * @since 0.1.0
 * @category constants
 */
export const noMIPROv2Progress: MIPROv2ProgressSink = () => noOpProgressEffect

/**
 * Discards formatted GEPA progress without adding Effect channels.
 *
 * @since 0.1.0
 * @category constants
 */
export const noGEPAProgress: GEPAProgressSink = () => noOpProgressEffect
