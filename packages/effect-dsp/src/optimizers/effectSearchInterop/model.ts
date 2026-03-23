/**
 * Stable contracts for the effect-dsp ↔ effect-search integration boundary —
 * trial payloads, result projections, and objective mappings.
 *
 * @since 0.0.0
 */
import { Option, Schema } from "effect"
import type * as Sampler from "effect-search/Sampler"
import type * as SearchSpace from "effect-search/SearchSpace"
import type * as Study from "effect-search/Study"
import * as StudyEvent from "effect-search/StudyEvent"

/**
 * Schema for the TPE acquisition strategies available through the adapter:
 * `"ei"` (expected improvement), `"pi"` (probability of improvement), or
 * `"thompson"` (Thompson sampling).
 *
 * @since 0.0.0
 * @category schemas
 */
export const EffectSearchAcquisitionStrategySchema = Schema.Literal("ei", "pi", "thompson")

/**
 * One of the supported TPE acquisition strategies.
 *
 * @see {@link EffectSearchAcquisitionStrategySchema}
 * @since 0.0.0
 * @category type-level
 */
export type EffectSearchAcquisitionStrategy = Schema.Schema.Type<typeof EffectSearchAcquisitionStrategySchema>

/**
 * Resolved TPE sampler configuration after defaults have been applied.
 *
 * @see {@link EffectSearchTpeSamplerInput} for the user-facing input shape
 * @since 0.0.0
 * @category models
 */
export class EffectSearchTpeSamplerOptions extends Schema.Class<EffectSearchTpeSamplerOptions>(
  "EffectSearchTpeSamplerOptions"
)({
  seed: Schema.OptionFromSelf(Schema.Number),
  multivariate: Schema.Boolean,
  acquisition: EffectSearchAcquisitionStrategySchema
}) {}

/**
 * User-facing TPE sampler options — all fields are optional and fall back to
 * {@link defaultEffectSearchTpeSamplerOptions}.
 *
 * @since 0.0.0
 * @category models
 */
export type EffectSearchTpeSamplerInput = Readonly<{
  readonly seed?: number
  readonly multivariate?: boolean
  readonly acquisition?: EffectSearchAcquisitionStrategy
}>

/**
 * Default TPE sampler configuration: no fixed seed, multivariate enabled,
 * expected-improvement acquisition.
 *
 * @since 0.0.0
 * @category constants
 */
export const defaultEffectSearchTpeSamplerOptions = new EffectSearchTpeSamplerOptions({
  seed: Option.none(),
  multivariate: true,
  acquisition: "ei"
})

/**
 * Options for opening a study handle — direction, search space, sampler,
 * trial budget, objective function, and optional concurrency cap.
 *
 * @since 0.0.0
 * @category models
 */
export type EffectSearchOpenOptions<Space extends SearchSpace.SearchSpace> = Readonly<{
  readonly direction: "maximize" | "minimize"
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly trials: number
  readonly objective: Study.ObjectiveFunction<SearchSpace.Type<Space>>
  readonly concurrency?: number
}>

/**
 * Opaque handle for ask/tell orchestration over an effect-search study.
 *
 * @since 0.0.0
 * @category type-level
 */
export type EffectSearchInteropHandle<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace> =
  Study.StudyHandle<Space>

/**
 * A trial reserved by `ask` that carries a suggested parameter configuration.
 *
 * @since 0.0.0
 * @category type-level
 */
export type EffectSearchAskedTrial<Config = unknown> = Study.AskedTrial<Config>

/**
 * Schema for study lifecycle events (trial started, completed, failed, etc.)
 * re-exported through the interop boundary.
 *
 * @since 0.0.0
 * @category schemas
 */
export const EffectSearchInteropEventSchema = StudyEvent.StudyEventSchema

/**
 * A study lifecycle event emitted during ask/tell orchestration.
 *
 * @see {@link EffectSearchInteropEventSchema}
 * @since 0.0.0
 * @category type-level
 */
export type EffectSearchInteropEvent = StudyEvent.StudyEvent

/**
 * A single formatted line of terminal progress output from a running study.
 *
 * @since 0.0.0
 * @category type-level
 */
export type EffectSearchProgressLine = Study.ProgressLine

/**
 * Discriminator for single-objective vs multi-objective study results.
 *
 * @since 0.0.0
 * @category schemas
 */
export const EffectSearchResultKindSchema = Schema.Literal("SingleObjective", "MultiObjective")

/**
 * `"SingleObjective"` or `"MultiObjective"` — indicates the shape of the
 * study result.
 *
 * @see {@link EffectSearchResultKindSchema}
 * @since 0.0.0
 * @category type-level
 */
export type EffectSearchResultKind = Schema.Schema.Type<typeof EffectSearchResultKindSchema>

/**
 * Portable summary of a completed study — trial count, best objective value,
 * and Pareto front size — insulated from upstream result-shape changes.
 *
 * @since 0.0.0
 * @category models
 */
export class EffectSearchResultSummary extends Schema.Class<EffectSearchResultSummary>("EffectSearchResultSummary")({
  kind: EffectSearchResultKindSchema,
  trialCount: Schema.Number,
  bestTrialNumber: Schema.OptionFromSelf(Schema.Number),
  bestObjective: Schema.OptionFromSelf(Schema.Number),
  paretoCount: Schema.NonNegative
}) {}
