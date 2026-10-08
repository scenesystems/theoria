/**
 * MIPROv2 Phase 3 search contracts and operations.
 *
 * @since 0.4.0
 * @module
 */
import type { Optimization } from "@scenesystems/effect-search"
import type { Option } from "effect"
import { Data, Effect, Schema } from "effect"
import { phase3TrialBudget as phase3TrialBudgetInternal } from "./internal/miprov2/runtime/budget.js"
import type { Phase3Config } from "./internal/miprov2/runtime/model.js"
import { runPhase3Search as runPhase3SearchInternal } from "./internal/miprov2/search.js"
import type { Metric } from "./Metric.js"
import { type Event, type Examples, TrialEvaluation } from "./MIPROv2.js"
import type { PredictorDemoCandidateSets, PredictorInstructionCandidateSets } from "./MIPROv2Candidates.js"
import type { Module as DspModule } from "./Module.js"
import type { ParameterSet } from "./ParameterSet.js"

/** Records the configured search shape and observed evaluation indexes.
 * @since 0.4.0
 * @category models
 */
export class Diagnostics extends Schema.Class<Diagnostics>("@scenesystems/effect-dsp/MIPROv2Search/Diagnostics")({
  dimensionNames: Schema.Array(Schema.String),
  samplerKind: Schema.Literal("tpe"),
  multivariate: Schema.Boolean,
  trialBudget: Schema.Finite,
  minibatchSize: Schema.Finite,
  fullEvalEvery: Schema.Finite,
  fullEvalTrialNumbers: Schema.Array(Schema.Finite),
  minibatchTrialNumbers: Schema.Array(Schema.Finite),
  priorTrialCount: Schema.Finite,
  baselineObjective: Schema.Finite,
  bestScore: Schema.Finite,
  bestTrial: Schema.Int,
  evaluations: Schema.Array(Schema.suspend(() => TrialEvaluation))
}) {}

/** Receives trial and full-set events in evaluation order.
 * @since 0.4.0
 * @category models
 */
export type EventSink<E = never, R = never> = (event: Event) => Effect.Effect<void, E, R>

/** Discards Phase 3 events.
 * @since 0.4.0
 * @category constants
 */
export const noEvents: EventSink = () => Effect.void

/** Configures direct Phase 3 search over prebuilt candidate sets.
 * @since 0.4.0
 * @category models
 */
export class Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never,
  EE = never,
  ER = never
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly valset: Examples
  readonly metric: Metric<ME, MR>
  readonly demoCandidates: PredictorDemoCandidateSets
  readonly instructionCandidates: PredictorInstructionCandidateSets
  readonly trialBudget?: number
  readonly minibatch?: boolean
  readonly minibatchSize?: number
  readonly fullEvalEvery?: number
  readonly seed?: number
  readonly numThreads?: number
  /** Failures that cancel one evaluation, which then scores 0; absent or none uses
   * DSPy's `dspy.settings.max_errors`, 10. */
  readonly maxErrors?: Option.Option<number>
  /** Logs every failed example at error level with its input: false (default, DSPy's setting) adds a
   * hint, true attaches the failure Cause with its stack. Events are unchanged and still emitted. */
  readonly provideTraceback?: boolean
  readonly emit?: EventSink<EE, ER>
}> {}

/** Pairs a bound program and parameters with its raw search result and diagnostics.
 * @since 0.4.0
 * @category models
 */
export class Result<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.Class<{
  readonly program: DspModule<I, O, E, R>
  readonly parameters: ParameterSet
  readonly optimizationResult: Optimization.Result<Phase3Config>
  readonly diagnostics: Diagnostics
}> {}

/** Computes the default Phase 3 trial count from search-space size.
 * @since 0.4.0
 * @category constructors
 */
export const trialBudget = phase3TrialBudgetInternal

/** Evaluates candidate indexes with a single-concurrency multivariate TPE optimization.
 * @since 0.4.0
 * @category constructors
 */
export const run = runPhase3SearchInternal
