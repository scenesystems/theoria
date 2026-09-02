/**
 * Defines reusable branded numbers for algorithm settings and shape metadata.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Schema } from "effect"

const ScalarFiniteNumber = Schema.Number.pipe(Schema.finite())
const ScalarFiniteInteger = Schema.Number.pipe(Schema.finite(), Schema.int())

/**
 * Brands positive finite integers used as vector, matrix, and point dimensions.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Dimension = ScalarFiniteInteger.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
  identifier: "Dimension"
}).pipe(Schema.brand("Dimension"))

/**
 * Brands zero-based finite integer axis indexes.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Axis = ScalarFiniteInteger.pipe(Schema.greaterThanOrEqualTo(0)).annotations({ identifier: "Axis" }).pipe(
  Schema.brand("Axis")
)

/**
 * Brands positive finite error limits measured in the result's units.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AbsoluteTolerance = ScalarFiniteNumber.pipe(Schema.greaterThan(0)).annotations({
  identifier: "AbsoluteTolerance"
}).pipe(Schema.brand("AbsoluteTolerance"))

/**
 * Brands positive finite unitless error limits.
 *
 * @since 0.1.0
 * @category contracts
 */
export const RelativeTolerance = ScalarFiniteNumber.pipe(Schema.greaterThan(0)).annotations({
  identifier: "RelativeTolerance"
}).pipe(Schema.brand("RelativeTolerance"))

/**
 * Brands non-negative finite integers used to reproduce seeded random streams.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Seed = ScalarFiniteInteger.pipe(Schema.greaterThanOrEqualTo(0)).annotations({ identifier: "Seed" }).pipe(
  Schema.brand("Seed")
)

/**
 * Brands positive finite integers used as maximum iteration counts.
 *
 * @since 0.1.0
 * @category contracts
 */
export const IterationBudget = ScalarFiniteInteger.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
  identifier: "IterationBudget"
}).pipe(Schema.brand("IterationBudget"))

/**
 * Brands positive finite cutoffs for operation-specific conditioning checks.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ConditioningThreshold = ScalarFiniteNumber.pipe(Schema.greaterThan(0)).annotations({
  identifier: "ConditioningThreshold"
}).pipe(Schema.brand("ConditioningThreshold"))

/**
 * Brands positive finite increments for numerical methods.
 *
 * @remarks
 * The consuming operation defines the unit and whether the value is an
 * initial, fixed, or maximum step.
 *
 * @since 0.1.0
 * @category contracts
 */
export const StepSize = ScalarFiniteNumber.pipe(Schema.greaterThan(0)).annotations({
  identifier: "StepSize"
}).pipe(Schema.brand("StepSize"))
