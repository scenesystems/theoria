import type { Option } from "effect"
import { Data, Match, Predicate, Schema } from "effect"

export const BuiltInAcquisitionNameSchema = Schema.Literal("ei", "pi", "thompson")

export type BuiltInAcquisitionName = Schema.Schema.Type<typeof BuiltInAcquisitionNameSchema>

export class AcquisitionContext extends Data.Class<{
  readonly logL: number
  readonly logG: number
  readonly estimatedCost: Option.Option<number>
  readonly roll: Option.Option<number>
}> {}

export type AcquisitionScore = (context: AcquisitionContext) => number

export class AcquisitionImplementation extends Data.Class<{
  readonly name: string
  readonly score: AcquisitionScore
}> {}

export type AcquisitionOption = BuiltInAcquisitionName | AcquisitionImplementation

export const isBuiltInAcquisitionName = (input: unknown): input is BuiltInAcquisitionName =>
  Match.value(input).pipe(
    Match.when("ei", () => true),
    Match.when("pi", () => true),
    Match.when("thompson", () => true),
    Match.orElse(() => false)
  )

export const isAcquisitionImplementation = (
  input: unknown
): input is AcquisitionImplementation =>
  Predicate.isRecord(input) &&
  Predicate.hasProperty(input, "name") &&
  Predicate.isString(input.name) &&
  Predicate.hasProperty(input, "score") &&
  Predicate.isFunction(input.score)
