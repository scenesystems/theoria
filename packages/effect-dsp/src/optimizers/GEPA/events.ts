/**
 * Defines the closed lifecycle event protocol emitted by GEPA.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

/**
 * Decodes iteration, merge, mutation, acceptance, frontier, and completion events.
 *
 * @remarks
 * Instructions appear only on `MutationProposed` and may contain sensitive
 * prompt content. Candidate IDs identify states within one run. Frontier and
 * dominated indices refer to the candidate array maintained by that run.
 *
 * @since 0.1.0
 * @category events
 */
export const GEPAEventSchema = Schema.Union(
  Schema.TaggedStruct("IterationStarted", {
    /** One-based optimization iteration entering execution. */
    iteration: Schema.Number,
    /** Pareto-front size before merge and mutation. */
    frontierSize: Schema.Number
  }),
  Schema.TaggedStruct("MergeChecked", {
    /** Iteration in which the merge check ran. */
    iteration: Schema.Number,
    /** Whether the runtime evaluated a merge candidate. */
    attempted: Schema.Boolean,
    /** Whether an evaluated merge candidate entered optimizer state. */
    accepted: Schema.Boolean,
    /** Merge evaluations still available after this check. */
    mergeBudgetRemaining: Schema.Number
  }),
  Schema.TaggedStruct("MutationProposed", {
    /** Iteration that produced the mutation. */
    iteration: Schema.Number,
    /** Run-local identity of the selected parent candidate. */
    parentId: Schema.String,
    /** Run-local identity assigned to the mutation candidate. */
    mutatedCandidateId: Schema.String,
    /** Predictor whose instruction was selected for mutation. */
    predictorName: Schema.String,
    /** Proposed instruction; may contain sensitive model output. */
    instruction: Schema.String
  }),
  Schema.TaggedStruct("AcceptanceEvaluated", {
    /** Iteration whose mutation was evaluated. */
    iteration: Schema.Number,
    /** Whether the mutation passed both acceptance stages. */
    accepted: Schema.Boolean,
    /** Whether the mutation improved the configured subsample. */
    gate1Passed: Schema.Boolean,
    /** Whether acceptance evaluated the full validation set. */
    fullValsetEvaluated: Schema.Boolean,
    /** Sum of parent scores in the acceptance subsample. */
    previousSubsampleSum: Schema.Number,
    /** Sum of mutation scores in the acceptance subsample. */
    mutatedSubsampleSum: Schema.Number
  }),
  Schema.TaggedStruct("ParetoUpdated", {
    /** Iteration after which the frontier was recomputed. */
    iteration: Schema.Number,
    /** Candidate-array indices in the first non-dominated front. */
    frontierIndices: Schema.Array(Schema.Number),
    /** Candidate-array indices outside the first front. */
    dominatedIndices: Schema.Array(Schema.Number),
    parentWeights: Schema.Array(
      Schema.Struct({
        /** Candidate-array index eligible for weighted parent selection. */
        candidateIndex: Schema.Number,
        /** Number of objective coordinates held at the best value. */
        weight: Schema.Number
      })
    )
  }),
  Schema.TaggedStruct("IterationCompleted", {
    /** One-based iteration that completed. */
    iteration: Schema.Number,
    /** Whether mutation added a candidate during the iteration. */
    acceptedCandidate: Schema.Boolean,
    /** Pareto-front size after merge and mutation. */
    frontierSize: Schema.Number
  }),
  Schema.TaggedStruct("OptimizationCompleted", {
    /** Number of optimization iterations executed. */
    iterations: Schema.Number,
    /** Run-local identity selected from the first Pareto-front position. */
    bestCandidateId: Schema.String,
    /** Size of the final Pareto front. */
    frontierSize: Schema.Number
  })
)

/**
 * Unites GEPA iteration, merge, mutation, frontier, and completion records.
 *
 * @since 0.1.0
 * @category events
 */
export type GEPAEvent = typeof GEPAEventSchema.Type

/**
 * Constructs and exhaustively matches lifecycle events by `_tag`.
 *
 * @since 0.1.0
 * @category events
 */
export const GEPAEvent = Data.taggedEnum<GEPAEvent>()
