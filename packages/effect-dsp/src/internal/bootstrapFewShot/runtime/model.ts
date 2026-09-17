/**
 * BootstrapFewShot runtime state — iteration counters, collected demos, and
 * scoring accumulators.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Data, Number, Schema } from "effect"
import { Demonstration as Demo } from "../../../Demonstration.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import type { ModuleParamRef } from "../../moduleParameters.js"

export const defaultBootstrapThreshold = 1

export const defaultBootstrapFallbackDemoCount = 3

export class PredictorDemos extends Data.Class<{
  readonly owner: ModuleParamRef
  readonly params: ModuleParameters
}> {}

export class AcceptedDemo extends Schema.Class<AcceptedDemo>("AcceptedDemo")({
  name: Schema.String,
  demo: Demo
}) {}

const AcceptedDemos = Schema.Array(AcceptedDemo)

export class ExampleEvaluation extends Data.Class<{
  readonly demos: typeof AcceptedDemos.Type
  readonly traceCount: number
  readonly acceptedCount: number
  readonly rejectedCount: number
  readonly score: number
}> {}

export class RoundEvaluation extends Data.Class<{
  readonly acceptedDemos: typeof AcceptedDemos.Type
  readonly traceCount: number
  readonly acceptedCount: number
  readonly rejectedCount: number
  readonly evaluatedCount: number
  readonly scoreSum: number
  readonly bestScoreSeen: boolean
  readonly bestScore: number
}> {}

export class DemoMerge extends Data.Class<{
  readonly demos: ModuleParameters["demos"]
  readonly added: number
}> {}

export class BootstrapState extends Data.Class<{
  readonly round: number
  readonly roundsAttempted: number
  readonly predictors: Arr.NonEmptyReadonlyArray<PredictorDemos>
  readonly totalTraces: number
  readonly acceptedTraces: number
  readonly rejectedTraces: number
  readonly evaluatedExamples: number
  readonly scoreSum: number
  readonly bestScoreSeen: boolean
  readonly bestScore: number
  readonly fallbackUsed: boolean
  readonly continue: boolean
}> {}

export const demoCount = (predictors: Iterable<PredictorDemos>): number =>
  Arr.reduce(predictors, 0, (count, predictor) => Number.sum(count, Arr.length(predictor.params.demos)))
