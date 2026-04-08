import { Schema } from "effect"

import { DspModuleType, DspScenarioId } from "./effect-dsp.js"

const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

export const DspStageId = Schema.Literal(
  "signature",
  "baseline",
  "optimizing",
  "optimized-eval",
  "comparison"
)

export type DspStageId = typeof DspStageId.Type

export const dspStageIds: ReadonlyArray<DspStageId> = [
  "signature",
  "baseline",
  "optimizing",
  "optimized-eval",
  "comparison"
]

export const DspRunMetrics = Schema.Struct({
  baselineAccuracy: Schema.NullOr(Schema.Number),
  optimizedAccuracy: Schema.NullOr(Schema.Number),
  demosLearned: Schema.NullOr(Schema.Number),
  improvementDelta: Schema.NullOr(Schema.Number)
})

export type DspRunMetrics = typeof DspRunMetrics.Type

export const emptyDspRunMetrics: DspRunMetrics = {
  baselineAccuracy: null,
  optimizedAccuracy: null,
  demosLearned: null,
  improvementDelta: null
}

export class DspCanonicalStep extends Schema.TaggedClass<DspCanonicalStep>()("DspCanonicalStep", {
  scenarioId: DspScenarioId,
  moduleType: DspModuleType,
  stageId: DspStageId,
  stepIndex: PositiveInt,
  stepCount: PositiveInt,
  metrics: DspRunMetrics
}) {}

export class DspRunFrame extends Schema.TaggedClass<DspRunFrame>()("effect-dsp", {
  scenarioId: DspScenarioId,
  stageId: DspStageId,
  stepIndex: PositiveInt,
  stepCount: PositiveInt,
  metrics: DspRunMetrics
}) {}

export const isDspRunFrame = Schema.is(DspRunFrame)
