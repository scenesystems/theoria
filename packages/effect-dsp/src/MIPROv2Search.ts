/**
 * MIPROv2 Phase 3 search contracts and operations.
 *
 * @since 0.4.0
 * @module
 */
import type { Optimization } from "@scenesystems/effect-search"
import { Data, Effect, Schema } from "effect"
import { phase3TrialBudget as phase3TrialBudgetInternal } from "./internal/miprov2/runtime/budget.js"
import type { Phase3Config } from "./internal/miprov2/runtime/model.js"
import { runPhase3Search as runPhase3SearchInternal } from "./internal/miprov2/search.js"
import type { Metric } from "./Metric.js"
import type { Event, Examples } from "./MIPROv2.js"
import type { PredictorDemoCandidateSets, PredictorInstructionCandidateSets } from "./MIPROv2Candidates.js"
import type { Module as DspModule } from "./Module.js"

/** Records the configured search shape and observed evaluation indexes.
 * @since 0.4.0
 * @category models
 */
export class Diagnostics extends Schema.Class<Diagnostics>("effect-dsp/MIPROv2Search/Diagnostics")({
  dimensionNames: Schema.Array(Schema.String),
  samplerKind: Schema.Literal("tpe"),
  multivariate: Schema.Boolean,
  trialBudget: Schema.Number,
  minibatchSize: Schema.Number,
  fullEvalEvery: Schema.Number,
  fullEvalTrialNumbers: Schema.Array(Schema.Number),
  minibatchTrialNumbers: Schema.Array(Schema.Number),
  priorTrialCount: Schema.Number,
  baselineObjective: Schema.Number,
  bestScore: Schema.Number
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
  readonly metric: Metric<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>
  readonly demoCandidates: PredictorDemoCandidateSets
  readonly instructionCandidates: PredictorInstructionCandidateSets
  readonly trialBudget?: number
  readonly minibatchSize?: number
  readonly fullEvalEvery?: number
  readonly seed?: number
  readonly emit?: EventSink<EE, ER>
}> {}

/** Pairs the mutated module with its raw search result and diagnostics.
 * @since 0.4.0
 * @category models
 */
export class Result<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly studyResult: Optimization.Result<Phase3Config>
  readonly diagnostics: Diagnostics
}> {}

/** Computes the default Phase 3 trial count from search-space size.
 * @since 0.4.0
 * @category constructors
 */
export const trialBudget = phase3TrialBudgetInternal

/** Evaluates candidate indexes with a single-concurrency multivariate TPE study.
 * @since 0.4.0
 * @category constructors
 */
export const run = runPhase3SearchInternal
