/**
 * Describes Phase 3 inputs, results, event sinks, and diagnostics.
 *
 * @since 0.1.0
 */
import type { Study } from "@scenesystems/effect-search"
import { Data, Effect, Schema } from "effect"
import type { Example } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import type { Module as DspModule } from "../../Module/model.js"
import type { PredictorDemoCandidates } from "./bootstrap.js"
import type { MIPROv2Event as MIPROv2EventType } from "./events.js"
import type { PredictorInstructionCandidates } from "./propose.js"
import type { Phase3Config } from "./runtime/model.js"

/**
 * Records the configured search shape and observed evaluation indexes.
 *
 * @remarks
 * `bestScore` is the maximum recorded baseline, minibatch, or full-set score;
 * it may describe a different configuration from `studyResult.bestTrial`.
 *
 * @since 0.1.0
 * @category models
 */
export class Phase3Diagnostics extends Schema.Class<Phase3Diagnostics>("MIPROv2Phase3Diagnostics")({
  /** Demonstration and instruction dimension names in predictor order. */
  dimensionNames: Schema.Array(Schema.String),
  /** Sampler discriminator; Phase 3 currently records only `"tpe"`. */
  samplerKind: Schema.Literal("tpe"),
  /** Whether the configured TPE sampler models dimensions jointly. */
  multivariate: Schema.Boolean,
  /** Normalized number of new study trials, excluding the prior baseline trial. */
  trialBudget: Schema.Number,
  /** Normalized leading validation-set prefix size used by each trial. */
  minibatchSize: Schema.Number,
  /** Normalized number of trials between full-set diagnostic evaluations. */
  fullEvalEvery: Schema.Number,
  /** Zero-based trial indexes followed by a full-set diagnostic evaluation. */
  fullEvalTrialNumbers: Schema.Array(Schema.Number),
  /** Zero-based indexes of trials evaluated on the minibatch prefix. */
  minibatchTrialNumbers: Schema.Array(Schema.Number),
  /** Number of baseline trials supplied to the study; currently one. */
  priorTrialCount: Schema.Number,
  /** Full validation-set score for the index-zero configuration. */
  baselineObjective: Schema.Number,
  /** Maximum score observed across baseline, minibatch, and full-set evaluations. */
  bestScore: Schema.Number
}) {}

/**
 * Configures direct Phase 3 search over prebuilt candidate sets.
 *
 * @typeParam I - Input fields accepted by the evaluated module.
 * @typeParam O - Output fields scored by the configured metric.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @since 0.1.0
 * @category models
 */
export class RunPhase3SearchOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> extends Data.Class<{
  /** Module tree mutated during evaluation and left with the selected configuration. */
  readonly module: DspModule<I, O>
  /** Full evaluation set; trial objectives use its leading `minibatchSize` entries. */
  readonly valset: ReadonlyArray<Example>
  /** Single objective used by all Phase 3 evaluations. */
  readonly metric: Metric<ME, MR>
  /** Demonstration candidates matched to module predictors by exact name. */
  readonly demoCandidates: ReadonlyArray<PredictorDemoCandidates>
  /** Instruction candidates matched to module predictors by exact name. */
  readonly instructionCandidates: ReadonlyArray<PredictorInstructionCandidates>
  /** Number of new study trials; defaults from {@link phase3TrialBudget} and normalizes to a positive integer. */
  readonly trialBudget?: number
  /** Leading validation-set prefix size. Defaults to `50` and normalizes to a positive integer. */
  readonly minibatchSize?: number
  /** Full-set diagnostic cadence. Defaults to `5` and normalizes to a positive integer. */
  readonly fullEvalEvery?: number
  /** TPE seed normalized to a positive integer. Defaults to `1`. */
  readonly seed?: number
  /** Sink awaited after each trial and full-set checkpoint event. */
  readonly emit?: Phase3EventSink
}> {}

/**
 * Pairs the mutated module with its raw search result and Phase 3 diagnostics.
 *
 * @typeParam I - Input fields accepted by the returned module.
 * @typeParam O - Output fields returned by the module.
 *
 * @since 0.1.0
 * @category models
 */
export class Phase3SearchResult<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> extends Data.Class<{
  /** Same module instance supplied to `runPhase3Search`. */
  readonly module: DspModule<I, O>
  /** Completed study including the prior baseline and new trials. */
  readonly studyResult: Study.StudyResult<Phase3Config>
  /** Search configuration and evaluation indexes observed during this run. */
  readonly diagnostics: Phase3Diagnostics
}> {}

/**
 * Receives trial and full-set events in evaluation order.
 *
 * @since 0.1.0
 * @category models
 */
export type Phase3EventSink = (event: MIPROv2EventType) => Effect.Effect<void>

/**
 * Discards Phase 3 events without adding a failure or service requirement.
 *
 * @since 0.1.0
 * @category constants
 */
export const noPhase3Events: Phase3EventSink = () => Effect.void
