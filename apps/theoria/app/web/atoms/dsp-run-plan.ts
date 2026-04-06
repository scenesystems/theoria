import { Schema } from "effect"

import {
  DspModuleType,
  type DspModuleType as DspModuleTypeValue,
  DspScenarioId,
  type DspScenarioId as DspScenarioIdValue
} from "../../contracts/demo/dsp.js"

export const EffectDspRunPlan = Schema.Struct({
  _tag: Schema.Literal("effect-dsp"),
  scenarioId: DspScenarioId,
  moduleType: DspModuleType,
  optimizationBudget: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
})

export type EffectDspRunPlan = typeof EffectDspRunPlan.Type

export const isEffectDspRunPlan = Schema.is(EffectDspRunPlan)

export const snapshotEffectDspRunPlan = ({
  scenarioId,
  moduleType,
  optimizationBudget
}: {
  readonly scenarioId: DspScenarioIdValue
  readonly moduleType: DspModuleTypeValue
  readonly optimizationBudget: number
}): EffectDspRunPlan => ({
  _tag: "effect-dsp",
  scenarioId,
  moduleType,
  optimizationBudget
})
