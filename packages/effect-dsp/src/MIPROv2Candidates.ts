/**
 * MIPROv2 demonstration and instruction candidate construction.
 *
 * @since 0.4.0
 * @module
 */
import { Data, Schema } from "effect"
import { generateDemoCandidates as generateDemoCandidatesInternal } from "./internal/miprov2/bootstrap.js"
import { proposeInstructionCandidates as proposeInstructionCandidatesInternal } from "./internal/miprov2/propose.js"
import type { Examples, TipVocabulary } from "./MIPROv2.js"
import type { Module as DspModule } from "./Module.js"
import { ModuleParameters } from "./ModuleParameters.js"

/** Identifies a Phase 1 demonstration layout.
 * @since 0.4.0
 * @category schemas
 */
export const DemoCandidateKind = Schema.Literal(
  "zero-shot",
  "labels-only",
  "bootstrap-unshuffled",
  "bootstrap-shuffled"
)

/** Identifies a Phase 1 demonstration layout.
 * @since 0.4.0
 * @category type-level
 */
export type DemoCandidateKind = typeof DemoCandidateKind.Type

/** Couples a predictor parameter snapshot with its demonstration layout.
 * @since 0.4.0
 * @category models
 */
export class DemoCandidate extends Schema.Class<DemoCandidate>("effect-dsp/MIPROv2Candidates/DemoCandidate")({
  predictorName: Schema.String,
  kind: DemoCandidateKind,
  params: ModuleParameters
}) {}

/** Groups the ordered Phase 1 candidates for one predictor.
 * @since 0.4.0
 * @category models
 */
export class PredictorDemoCandidates
  extends Schema.Class<PredictorDemoCandidates>("effect-dsp/MIPROv2Candidates/PredictorDemoCandidates")({
    predictorName: Schema.String,
    candidates: Schema.Array(DemoCandidate)
  })
{}

/** Ordered Phase 1 candidate sets, one per predictor.
 * @since 0.4.0
 * @category schemas
 */
export const PredictorDemoCandidateSets = Schema.Array(PredictorDemoCandidates)

/** Ordered Phase 1 candidate sets, one per predictor.
 * @since 0.4.0
 * @category type-level
 */
export type PredictorDemoCandidateSets = typeof PredictorDemoCandidateSets.Type

/** Configures labeled demonstration selection for every owned predictor.
 * @since 0.4.0
 * @category models
 */
export class GenerateDemoCandidatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly trainset: Examples
  readonly numCandidates: number
  readonly seed?: number
  readonly maxLabeledDemos?: number
  readonly maxBootstrappedDemos?: number
}> {}

/** Snapshots every owned predictor and builds its demonstration candidates.
 * @since 0.4.0
 * @category constructors
 */
export const generateDemoCandidates = generateDemoCandidatesInternal

/** Records one baseline or model-generated instruction for a predictor.
 * @since 0.4.0
 * @category models
 */
export class InstructionCandidate
  extends Schema.Class<InstructionCandidate>("effect-dsp/MIPROv2Candidates/InstructionCandidate")({
    predictorName: Schema.String,
    instruction: Schema.String,
    tip: Schema.String,
    cacheBustMarker: Schema.String,
    prompt: Schema.String,
    isBaseline: Schema.Boolean
  })
{}

/** Groups one predictor's instruction candidates in search order.
 * @since 0.4.0
 * @category models
 */
export class PredictorInstructionCandidates extends Schema.Class<PredictorInstructionCandidates>(
  "effect-dsp/MIPROv2Candidates/PredictorInstructionCandidates"
)({
  predictorName: Schema.String,
  candidates: Schema.Array(InstructionCandidate)
}) {}

/** Ordered Phase 2 candidate sets, one per predictor.
 * @since 0.4.0
 * @category schemas
 */
export const PredictorInstructionCandidateSets = Schema.Array(PredictorInstructionCandidates)

/** Ordered Phase 2 candidate sets, one per predictor.
 * @since 0.4.0
 * @category type-level
 */
export type PredictorInstructionCandidateSets = typeof PredictorInstructionCandidateSets.Type

/** Configures instruction generation for every owned predictor.
 * @since 0.4.0
 * @category models
 */
export class ProposeInstructionCandidatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly trainset: Examples
  readonly demoCandidates: PredictorDemoCandidateSets
  readonly numInstructions: number
  readonly seed?: number
  readonly diversityTemperature?: number
  readonly tipVocabulary?: TipVocabulary
}> {}

/** Generates ordered instruction candidates without mutating module parameters.
 * @since 0.4.0
 * @category constructors
 */
export const proposeInstructionCandidates = proposeInstructionCandidatesInternal
