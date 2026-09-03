/**
 * Names accepted when configuring a built-in Bayesian acquisition strategy.
 *
 * @since 0.1.0
 */
import { Match, Schema } from "effect"

/**
 * Decodes the built-in `"ei"`, `"pi"`, and `"thompson"` strategy names.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BuiltInAcquisitionNameSchema = Schema.Literal("ei", "pi", "thompson")

/**
 * Selects one of the acquisition strategies implemented by the built-in samplers.
 *
 * @since 0.1.0
 * @category models
 */
export type BuiltInAcquisitionName = Schema.Schema.Type<typeof BuiltInAcquisitionNameSchema>

/**
 * Reports whether an unknown value names a built-in acquisition strategy.
 *
 * @since 0.1.0
 * @category guards
 */
export const isBuiltInAcquisitionName = (input: unknown): input is BuiltInAcquisitionName =>
  Match.value(input).pipe(
    Match.when("ei", () => true),
    Match.when("pi", () => true),
    Match.when("thompson", () => true),
    Match.orElse(() => false)
  )
