/**
 * Defines study options and result projections at the DSP optimizer boundary.
 *
 * @since 0.1.0
 */
import type * as Sampler from "@scenesystems/effect-search/Sampler"
import type * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import type * as Study from "@scenesystems/effect-search/Study"
import * as StudyEvent from "@scenesystems/effect-search/StudyEvent"
import { Data, Option, Schema } from "effect"

/**
 * Accepts expected improvement, probability of improvement, or Thompson sampling.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EffectSearchAcquisitionStrategySchema = Schema.Literal("ei", "pi", "thompson")

/**
 * Selects the acquisition calculation delegated to effect-search TPE.
 *
 * @see {@link EffectSearchAcquisitionStrategySchema}
 * @since 0.1.0
 * @category type-level
 */
export type EffectSearchAcquisitionStrategy = Schema.Schema.Type<typeof EffectSearchAcquisitionStrategySchema>

/**
 * Stores explicit seed presence and fully resolved sampler choices.
 *
 * @see {@link EffectSearchTpeSamplerInput} for the user-facing input shape
 * @since 0.1.0
 * @category models
 */
export class EffectSearchTpeSamplerOptions extends Schema.Class<EffectSearchTpeSamplerOptions>(
  "EffectSearchTpeSamplerOptions"
)({
  /** Fixed sampler seed when present. */
  seed: Schema.OptionFromSelf(Schema.Number),
  /** Whether TPE models dimensions jointly. */
  multivariate: Schema.Boolean,
  /** Acquisition calculation used to choose suggestions. */
  acquisition: EffectSearchAcquisitionStrategySchema
}) {}

/**
 * Overrides the adapter's default TPE sampler choices.
 *
 * @since 0.1.0
 * @category models
 */
export class EffectSearchTpeSamplerInput extends Data.Class<{
  /** Fixed seed for reproducible suggestions; omitted leaves the sampler unseeded. */
  readonly seed?: number
  /** Whether TPE models dimensions jointly; defaults to `true`. */
  readonly multivariate?: boolean
  /** Acquisition calculation; defaults to `"ei"`. */
  readonly acquisition?: EffectSearchAcquisitionStrategy
}> {}

/**
 * Uses no fixed seed, multivariate modeling, and expected improvement.
 *
 * @since 0.1.0
 * @category constants
 */
export const defaultEffectSearchTpeSamplerOptions = new EffectSearchTpeSamplerOptions({
  seed: Option.none(),
  multivariate: true,
  acquisition: "ei"
})

/**
 * Configures a scoped manual study while retaining config inference from its space.
 *
 * @since 0.1.0
 * @category models
 */
export class EffectSearchOpenOptions<Space extends SearchSpace.SearchSpace> extends Data.Class<{
  /** Whether smaller or larger objective values rank higher. */
  readonly direction: "maximize" | "minimize"
  /** Parameter definitions and conditional structure used for suggestions. */
  readonly space: Space
  /** Stateful suggestion policy owned by the opened study. */
  readonly sampler: Sampler.Sampler
  /** Maximum number of reserved trials. */
  readonly trials: number
  /** Objective metadata used by the study contract; ask/tell callers evaluate externally. */
  readonly objective: Study.ObjectiveFunction<SearchSpace.Type<Space>>
  /** Maximum concurrent objective evaluations recorded in study settings. */
  readonly concurrency?: number
}> {}

/**
 * Carries the scoped state of an effect-search manual study.
 *
 * @since 0.1.0
 * @category type-level
 */
export type EffectSearchInteropHandle<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace> =
  Study.StudyHandle<Space>

/**
 * Carries a pending trial number and a configuration inferred from its search space.
 *
 * @since 0.1.0
 * @category type-level
 */
export type EffectSearchAskedTrial<Config = unknown> = Study.AskedTrial<Config>

/**
 * Decodes the effect-search lifecycle events forwarded by the adapter.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EffectSearchInteropEventSchema = StudyEvent.StudyEventSchema

/**
 * Preserves an effect-search lifecycle event at the DSP optimizer boundary.
 *
 * @see {@link EffectSearchInteropEventSchema}
 * @since 0.1.0
 * @category type-level
 */
export type EffectSearchInteropEvent = StudyEvent.StudyEvent

/**
 * Preserves the destination stream and text selected by effect-search progress formatting.
 *
 * @since 0.1.0
 * @category type-level
 */
export type EffectSearchProgressLine = Study.ProgressLine

/**
 * Distinguishes scalar-incumbent results from Pareto-front results.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EffectSearchResultKindSchema = Schema.Literal("SingleObjective", "MultiObjective")

/**
 * Selects the populated fields in {@link EffectSearchResultSummary}.
 *
 * @see {@link EffectSearchResultKindSchema}
 * @since 0.1.0
 * @category type-level
 */
export type EffectSearchResultKind = Schema.Schema.Type<typeof EffectSearchResultKindSchema>

/**
 * Retains result kind, trial count, optional scalar incumbent, and Pareto size.
 *
 * @since 0.1.0
 * @category models
 */
export class EffectSearchResultSummary extends Schema.Class<EffectSearchResultSummary>("EffectSearchResultSummary")({
  /** Result shape selected by the study's objective count. */
  kind: EffectSearchResultKindSchema,
  /** Number of terminal and non-terminal trials in the result. */
  trialCount: Schema.Number,
  /** Scalar incumbent trial number; absent for multi-objective results. */
  bestTrialNumber: Schema.OptionFromSelf(Schema.Number),
  /** Scalar incumbent value; absent for multi-objective results. */
  bestObjective: Schema.OptionFromSelf(Schema.Number),
  /** Final frontier size, or one for a single-objective result. */
  paretoCount: Schema.NonNegative
}) {}
