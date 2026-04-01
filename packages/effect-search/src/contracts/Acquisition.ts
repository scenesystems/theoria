/**
 * Shared acquisition strategy contracts used by multiple samplers.
 *
 * @since 0.1.0
 */
import { Match, Schema } from "effect"

/**
 * Schema that validates a string as one of the built-in acquisition
 * strategy names: `"ei"`, `"pi"`, or `"thompson"`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BuiltInAcquisitionNameSchema = Schema.Literal("ei", "pi", "thompson")

/**
 * Literal union type of built-in acquisition strategy names.
 *
 * @since 0.1.0
 * @category models
 */
export type BuiltInAcquisitionName = Schema.Schema.Type<typeof BuiltInAcquisitionNameSchema>

/**
 * Type guard that narrows an unknown value to a built-in acquisition name.
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
