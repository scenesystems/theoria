/**
 * BootstrapFewShot runtime state — iteration counters, collected demos, and
 * scoring accumulators.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Data, Number, Schema } from "effect"
import type { ModuleParams } from "../../../contracts/ModuleParams.js"
import { Demo } from "../../../Example/index.js"
import type { ModuleParamRef } from "../../../internal/module-params.js"

export const DEFAULT_BOOTSTRAP_THRESHOLD = 1

export const DEFAULT_BOOTSTRAP_FALLBACK_DEMO_COUNT = 3

export class PredictorDemos extends Data.Class<{
  readonly owner: ModuleParamRef
  readonly params: ModuleParams
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
  readonly demos: ModuleParams["demos"]
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
