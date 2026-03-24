/**
 * Acquisition function model — context, scoring protocol, and type guards for acquisition strategies.
 *
 * @since 0.1.0
 */
import type { Option } from "effect"
import { Data, Match, Predicate, Schema } from "effect"

/** @since 0.1.0 */
export const BuiltInAcquisitionNameSchema = Schema.Literal("ei", "pi", "thompson")

/** @since 0.1.0 */
export type BuiltInAcquisitionName = Schema.Schema.Type<typeof BuiltInAcquisitionNameSchema>

/** @since 0.1.0 */
export class AcquisitionContext extends Data.Class<{
  readonly logL: number
  readonly logG: number
  readonly estimatedCost: Option.Option<number>
  readonly roll: Option.Option<number>
}> {}

/** @since 0.1.0 */
export type AcquisitionScore = (context: AcquisitionContext) => number

/** @since 0.1.0 */
export class AcquisitionImplementation extends Data.Class<{
  readonly name: string
  readonly score: AcquisitionScore
}> {}

/** @since 0.1.0 */
export type AcquisitionOption = BuiltInAcquisitionName | AcquisitionImplementation

/** @since 0.1.0 */
export const isBuiltInAcquisitionName = (input: unknown): input is BuiltInAcquisitionName =>
  Match.value(input).pipe(
    Match.when("ei", () => true),
    Match.when("pi", () => true),
    Match.when("thompson", () => true),
    Match.orElse(() => false)
  )

/** @since 0.1.0 */
export const isAcquisitionImplementation = (
  input: unknown
): input is AcquisitionImplementation =>
  Predicate.isRecord(input) &&
  Predicate.hasProperty(input, "name") &&
  Predicate.isString(input.name) &&
  Predicate.hasProperty(input, "score") &&
  Predicate.isFunction(input.score)
