import { Schema } from "effect"

const ScalarFiniteNumber = Schema.Number.pipe(Schema.finite())
const ScalarFiniteInteger = Schema.Number.pipe(Schema.finite(), Schema.int())

/**
 * Positive, finite integer dimensionality.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Dimension = ScalarFiniteInteger.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
  identifier: "Dimension"
}).pipe(Schema.brand("Dimension"))

/**
 * Non-negative, finite integer axis index.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Axis = ScalarFiniteInteger.pipe(Schema.greaterThanOrEqualTo(0)).annotations({ identifier: "Axis" }).pipe(
  Schema.brand("Axis")
)

/**
 * Strictly positive finite absolute tolerance.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AbsoluteTolerance = ScalarFiniteNumber.pipe(Schema.greaterThan(0)).annotations({
  identifier: "AbsoluteTolerance"
}).pipe(Schema.brand("AbsoluteTolerance"))

/**
 * Strictly positive finite relative tolerance.
 *
 * @since 0.1.0
 * @category contracts
 */
export const RelativeTolerance = ScalarFiniteNumber.pipe(Schema.greaterThan(0)).annotations({
  identifier: "RelativeTolerance"
}).pipe(Schema.brand("RelativeTolerance"))

/**
 * Non-negative finite integer seed.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Seed = ScalarFiniteInteger.pipe(Schema.greaterThanOrEqualTo(0)).annotations({ identifier: "Seed" }).pipe(
  Schema.brand("Seed")
)

/**
 * Positive finite integer iteration budget.
 *
 * @since 0.1.0
 * @category contracts
 */
export const IterationBudget = ScalarFiniteInteger.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
  identifier: "IterationBudget"
}).pipe(Schema.brand("IterationBudget"))

/**
 * Strictly positive finite conditioning threshold.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ConditioningThreshold = ScalarFiniteNumber.pipe(Schema.greaterThan(0)).annotations({
  identifier: "ConditioningThreshold"
}).pipe(Schema.brand("ConditioningThreshold"))

/**
 * Strictly positive finite integration/optimization step size.
 *
 * @since 0.1.0
 * @category contracts
 */
export const StepSize = ScalarFiniteNumber.pipe(Schema.greaterThan(0)).annotations({
  identifier: "StepSize"
}).pipe(Schema.brand("StepSize"))
