/**
 * Pareto objective vector model definitions.
 *
 * @since 0.1.0
 */

import { Schema } from "effect"

/**
 * Schema for a fixed-length numeric vector representing one candidate's objective values.
 *
 * All Pareto operators expect coordinates in the same positional order across candidates.
 * Direction interpretation (minimize/maximize) is handled by the consuming function, not
 * by this schema.
 *
 * @see {@link ObjectiveVector} Extracted type alias
 * @see {@link dominates} from `./dominance` — pairwise comparison over these vectors
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveVectorSchema = Schema.Array(Schema.Number)

/**
 * A single candidate's objective values as a positional numeric array.
 *
 * Index `i` corresponds to the `i`-th objective. All vectors in a comparison
 * must share the same length; mismatched lengths cause `dominates` to return `false`.
 *
 * @see {@link ObjectiveVectorSchema} Schema that produces this type
 * @see {@link dominates} from `./dominance` — pairwise dominance check
 *
 * @since 0.1.0
 * @category models
 */
export type ObjectiveVector = Schema.Schema.Type<typeof ObjectiveVectorSchema>

/**
 * Non-dominated point indices for a single objective coordinate.
 *
 * `holders` contains the indices of candidates that are non-dominated when
 * the objective matrix is projected onto the single coordinate at `objectiveIndex`.
 * `bestValue` is the best (direction-aware) value found among those holders.
 *
 * Produced by {@link objectiveFrontierHoldings} in `./frontier` and consumed by
 * weight-derivation helpers in `./weights`.
 *
 * @see {@link ObjectiveFrontierWeight} Aggregated weight per candidate across all holdings
 * @see {@link objectiveFrontierHoldings} from `./frontier` — produces these holdings
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveFrontierHolding extends Schema.Class<ObjectiveFrontierHolding>(
  "effect-search/ParetoObjectiveFrontierHolding"
)({
  objectiveIndex: Schema.Number,
  bestValue: Schema.Number,
  holders: Schema.Array(Schema.Number)
}) {}

/**
 * Candidate-level weight derived from objective frontier holdings.
 *
 * Weight equals the number of per-objective frontiers where a candidate appears
 * as a holder. A candidate on all `k` objective frontiers receives weight `k`;
 * one on none receives `0`. Higher weight indicates broader Pareto competitiveness.
 *
 * @see {@link ObjectiveFrontierHolding} Per-objective holding that feeds this weight
 * @see {@link objectiveFrontierWeights} from `./weights` — produces these weights
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveFrontierWeight extends Schema.Class<ObjectiveFrontierWeight>(
  "effect-search/ParetoObjectiveFrontierWeight"
)({
  candidateIndex: Schema.Number,
  weight: Schema.Number
}) {}

/**
 * Complete deterministic snapshot of a Pareto frontier analysis.
 *
 * **Fields**
 * - `frontierIndices` — indices of non-dominated candidates (first front)
 * - `dominatedIndices` — complement set: indices dominated by at least one frontier member
 * - `objectiveHoldings` — per-objective holder sets (one entry per objective coordinate)
 * - `holdingWeights` — per-candidate weight derived from how many objective frontiers include them
 *
 * Built atomically by {@link frontierSnapshot} in `./weights` so all fields are consistent
 * with respect to the same input matrix and directions.
 *
 * @see {@link frontierSnapshot} from `./weights` — produces this snapshot
 * @see {@link ObjectiveFrontierHolding} Individual objective holding entry
 * @see {@link ObjectiveFrontierWeight} Per-candidate weight entry
 *
 * @since 0.1.0
 * @category models
 */
export class FrontierSnapshot extends Schema.Class<FrontierSnapshot>(
  "effect-search/ParetoFrontierSnapshot"
)({
  frontierIndices: Schema.Array(Schema.Number),
  dominatedIndices: Schema.Array(Schema.Number),
  objectiveHoldings: Schema.Array(ObjectiveFrontierHolding),
  holdingWeights: Schema.Array(ObjectiveFrontierWeight)
}) {}
