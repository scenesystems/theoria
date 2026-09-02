/**
 * Serializable objective vectors and the records produced by Pareto analysis.
 *
 * @since 0.1.0
 */

import { Schema } from "effect"

/**
 * Decodes the ordered objective coordinates for one candidate.
 *
 * @remarks
 * The schema accepts empty arrays and non-finite numbers. It does not establish
 * the equal-length and finite-coordinate preconditions of Pareto operations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveVectorSchema = Schema.Array(Schema.Number)

/**
 * Ordered objective coordinates for one candidate. Coordinate positions must
 * match the corresponding direction vector and every other candidate under comparison.
 *
 * @since 0.1.0
 * @category models
 */
export type ObjectiveVector = Schema.Schema.Type<typeof ObjectiveVectorSchema>

/**
 * Records the best value for one objective coordinate and the input indices
 * whose coordinate equals that value.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveFrontierHolding extends Schema.Class<ObjectiveFrontierHolding>(
  "effect-search/ParetoObjectiveFrontierHolding"
)({
  /** Zero-based coordinate position in the analyzed objective vectors. */
  objectiveIndex: Schema.Number,
  /** Best coordinate value under the direction used for this analysis. */
  bestValue: Schema.Number,
  /** Input candidate indices whose coordinate equals the best value. */
  holders: Schema.Array(Schema.Number)
}) {}

/**
 * Associates an input candidate with the number of objective coordinates on
 * which it holds the best value. The weight ranges from zero through the matrix arity.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveFrontierWeight extends Schema.Class<ObjectiveFrontierWeight>(
  "effect-search/ParetoObjectiveFrontierWeight"
)({
  /** Zero-based position of the candidate in the analyzed input. */
  candidateIndex: Schema.Number,
  /** Number of coordinates on which the candidate holds the best value. */
  weight: Schema.Number
}) {}

/**
 * Captures the first Pareto front, its input-order complement, and exact
 * per-coordinate best-value holdings from one analysis.
 *
 * @remarks
 * `holdingWeights` contains one entry for every input candidate. Its values count
 * membership in `objectiveHoldings`, not membership in the multi-objective front.
 *
 * @since 0.1.0
 * @category models
 */
export class FrontierSnapshot extends Schema.Class<FrontierSnapshot>(
  "effect-search/ParetoFrontierSnapshot"
)({
  /** Input indices in the first non-dominated front, preserving input order. */
  frontierIndices: Schema.Array(Schema.Number),
  /** Input indices outside the first front, preserving input order. */
  dominatedIndices: Schema.Array(Schema.Number),
  /** Best value and exact holders for each objective coordinate. */
  objectiveHoldings: Schema.Array(ObjectiveFrontierHolding),
  /** One coordinate-holding count for every input candidate. */
  holdingWeights: Schema.Array(ObjectiveFrontierWeight)
}) {}
