/**
 * MIPROv2 Phase 3 public contracts — trial results and diagnostic snapshots.
 *
 * @since 0.0.0
 */
import { Effect, Schema } from "effect"
import type { Study } from "effect-search"
import type { Example } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import type { Module as DspModule } from "../../Module/model.js"
import type { PredictorDemoCandidates } from "./bootstrap.js"
import type { MIPROv2Event as MIPROv2EventType } from "./events.js"
import type { PredictorInstructionCandidates } from "./propose.js"
import type { Phase3Config } from "./runtime/model.js"

/**
 * Phase-3 diagnostics emitted for proofs and governance checks.
 *
 * @since 0.0.0
 * @category models
 */
export class Phase3Diagnostics extends Schema.Class<Phase3Diagnostics>("MIPROv2Phase3Diagnostics")({
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

/**
 * Phase-3 options.
 *
 * @since 0.0.0
 * @category models
 */
export type RunPhase3SearchOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  readonly module: DspModule<I, O>
  readonly valset: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
  readonly demoCandidates: ReadonlyArray<PredictorDemoCandidates>
  readonly instructionCandidates: ReadonlyArray<PredictorInstructionCandidates>
  readonly trialBudget?: number
  readonly minibatchSize?: number
  readonly fullEvalEvery?: number
  readonly seed?: number
  readonly emit?: Phase3EventSink
}>

/**
 * Phase-3 return value.
 *
 * @since 0.0.0
 * @category models
 */
export type Phase3SearchResult<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly module: DspModule<I, O>
  readonly studyResult: Study.StudyResult<Phase3Config>
  readonly diagnostics: Phase3Diagnostics
}>

/**
 * Phase-3 progress sink.
 *
 * @since 0.0.0
 * @category models
 */
export type Phase3EventSink = (event: MIPROv2EventType) => Effect.Effect<void>

/**
 * No-op sink used by non-streaming orchestration.
 *
 * @since 0.0.0
 * @category constants
 */
export const noPhase3Events: Phase3EventSink = () => Effect.void
