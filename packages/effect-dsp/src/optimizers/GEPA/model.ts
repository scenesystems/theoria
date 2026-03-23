/**
 * GEPA optimizer data types — candidates, scores, Pareto snapshots, and
 * reflective examples.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.0.0
 */
import { Schema } from "effect"
import { FieldRecord } from "../../contracts/FieldValue.js"
import { MetricResult } from "../../contracts/MetricResult.js"

/**
 * Per-example score array for one candidate program across the validation set.
 *
 * @since 0.0.0
 * @category schemas
 */
export const CandidateScoreVector = Schema.Array(Schema.Number)

/**
 * Per-example score array for one candidate program across the validation set.
 *
 * @since 0.0.0
 * @category models
 */
export type CandidateScoreVector = typeof CandidateScoreVector.Type

/**
 * Two-gate mutation acceptance result. Gate 1 requires strict minibatch
 * improvement (`newSum > oldSum`). Gate 2 runs full-valset evaluation only
 * when gate 1 passes.
 *
 * @since 0.0.0
 * @category models
 */
export class MutationAcceptance extends Schema.Class<MutationAcceptance>("GEPAMutationAcceptance")({
  previousSubsampleSum: Schema.Number,
  mutatedSubsampleSum: Schema.Number,
  gate1Passed: Schema.Boolean,
  fullValsetEvaluated: Schema.Boolean,
  fullValsetScores: Schema.OptionFromSelf(CandidateScoreVector),
  fullValsetSum: Schema.OptionFromSelf(Schema.Number)
}) {}

/**
 * Merge acceptance result using the non-strict comparator
 * (`mergedSum >= bestParentSum`).
 *
 * @since 0.0.0
 * @category models
 */
export class MergeAcceptance extends Schema.Class<MergeAcceptance>("GEPAMergeAcceptance")({
  mergedSubsampleSum: Schema.Number,
  bestParentSubsampleSum: Schema.Number,
  accepted: Schema.Boolean
}) {}

/**
 * Per-example Pareto frontier analysis — tracks which candidates hold the
 * best score for each validation example.
 *
 * @since 0.0.0
 * @category models
 */
export class ExampleFrontierHolding extends Schema.Class<ExampleFrontierHolding>("GEPAExampleFrontierHolding")({
  exampleIndex: Schema.Number,
  bestScore: Schema.Number,
  holders: Schema.Array(Schema.Number)
}) {}

/**
 * Weighted parent selection entry — weight equals the number of per-example
 * frontier positions held by this candidate.
 *
 * @since 0.0.0
 * @category models
 */
export class ParentSelectionWeight extends Schema.Class<ParentSelectionWeight>("GEPAParentSelectionWeight")({
  candidateIndex: Schema.Number,
  weight: Schema.Number
}) {}

/**
 * Complete Pareto frontier snapshot for one score matrix — frontier indices,
 * dominated indices, per-example holdings, and derived parent weights.
 *
 * @since 0.0.0
 * @category models
 */
export class ParetoKernelSnapshot extends Schema.Class<ParetoKernelSnapshot>("GEPAParetoKernelSnapshot")({
  frontierIndices: Schema.Array(Schema.Number),
  dominatedIndices: Schema.Array(Schema.Number),
  exampleHoldings: Schema.Array(ExampleFrontierHolding),
  parentWeights: Schema.Array(ParentSelectionWeight)
}) {}

/**
 * A frozen reflective-example row for mutation prompts — shows the model its
 * input, generated output, expected output, feedback, and score.
 *
 * @since 0.0.0
 * @category models
 */
export class ReflectiveExample extends Schema.Class<ReflectiveExample>("GEPAReflectiveExample")({
  exampleId: Schema.String,
  predictorName: Schema.String,
  inputs: FieldRecord,
  generatedOutputs: FieldRecord,
  expectedOutput: FieldRecord,
  feedback: Schema.String,
  score: Schema.Number
}) {}

/**
 * Source row used to construct reflective examples from runtime traces and
 * metrics. `metricResult.feedback` provides the canonical feedback.
 * `parseFailureStructure` injects format guidance when parsing failed.
 *
 * @since 0.0.0
 * @category models
 */
export class ReflectiveDatasetSample extends Schema.Class<ReflectiveDatasetSample>("GEPAReflectiveDatasetSample")({
  exampleId: Schema.String,
  predictorName: Schema.String,
  inputs: FieldRecord,
  generatedOutputs: FieldRecord,
  expectedOutput: FieldRecord,
  metricResult: MetricResult,
  parseFailureStructure: Schema.optional(Schema.String)
}) {}

/**
 * Instruction payload for one predictor in a GEPA candidate program.
 *
 * @since 0.0.0
 * @category models
 */
export class PredictorInstruction extends Schema.Class<PredictorInstruction>("GEPAPredictorInstruction")({
  predictorName: Schema.String,
  instruction: Schema.String
}) {}

/**
 * A candidate program in the GEPA population — carries a unique id, parent
 * lineage, and per-predictor instructions.
 *
 * @since 0.0.0
 * @category models
 */
export class ProgramCandidate extends Schema.Class<ProgramCandidate>("GEPAProgramCandidate")({
  candidateId: Schema.String,
  parentIds: Schema.Array(Schema.String),
  predictorInstructions: Schema.Array(PredictorInstruction)
}) {}

/**
 * Per-example score comparison between two parent candidates during
 * merge/crossover.
 *
 * @since 0.0.0
 * @category models
 */
export class MergeComparison extends Schema.Class<MergeComparison>("GEPAMergeComparison")({
  exampleId: Schema.String,
  parentAScore: Schema.Number,
  parentBScore: Schema.Number
}) {}

/**
 * Bucket classification for balanced merge subsampling — determines whether
 * parent A, parent B, or neither dominates each example.
 *
 * @since 0.0.0
 * @category schemas
 */
export const MergeComparisonBucketSchema = Schema.Literal("parent-a-better", "parent-b-better", "tie")

/**
 * Bucket classification for balanced merge subsampling — determines whether
 * parent A, parent B, or neither dominates each example.
 *
 * @since 0.0.0
 * @category models
 */
export type MergeComparisonBucket = typeof MergeComparisonBucketSchema.Type

/**
 * Mutable merge phase state — tracks accepted candidates and remaining
 * merge budget.
 *
 * @since 0.0.0
 * @category models
 */
export class MergeState extends Schema.Class<MergeState>("GEPAMergeState")({
  candidates: Schema.Array(ProgramCandidate),
  mergeBudgetRemaining: Schema.Number
}) {}

/**
 * Full GEPA optimizer state persisted in a `Ref` during orchestration —
 * iteration count, candidate population, score matrix, Pareto snapshot,
 * merge budget, and deterministic seed.
 *
 * @since 0.0.0
 * @category models
 */
export class GEPAState extends Schema.Class<GEPAState>("GEPAState")({
  iteration: Schema.Number,
  candidates: Schema.Array(ProgramCandidate),
  scoreVectors: Schema.Array(CandidateScoreVector),
  paretoSnapshot: ParetoKernelSnapshot,
  mergeBudgetRemaining: Schema.Number,
  lastIterationFoundNew: Schema.Boolean,
  seed: Schema.Number
}) {}
