import { Schema } from "effect"

import {
  DspModuleType,
  type DspModuleType as DspModuleTypeValue,
  DspScenarioId,
  type DspScenarioId as DspScenarioIdValue
} from "../../contracts/capability/effect-dsp.js"

export const EffectDspProjectionScript = Schema.Struct({
  _tag: Schema.Literal("effect-dsp"),
  scenarioId: DspScenarioId,
  moduleType: DspModuleType,
  optimizationBudget: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
})

export type EffectDspProjectionScript = typeof EffectDspProjectionScript.Type

export const isEffectDspProjectionScript = Schema.is(EffectDspProjectionScript)

export const snapshotEffectDspProjectionScript = ({
  scenarioId,
  moduleType,
  optimizationBudget
}: {
  readonly scenarioId: DspScenarioIdValue
  readonly moduleType: DspModuleTypeValue
  readonly optimizationBudget: number
}): EffectDspProjectionScript => ({
  _tag: "effect-dsp",
  scenarioId,
  moduleType,
  optimizationBudget
})
