import { type DspModuleType, type DspScenarioId, dspScenarios, moduleTypeFromIndex } from "../../contracts/demo/dsp.js"

export type EffectDspRunPlan = {
  readonly _tag: "effect-dsp"
  readonly scenarioId: DspScenarioId
  readonly moduleType: DspModuleType
  readonly optimizationBudget: number
}

export const snapshotEffectDspRunPlan = ({
  scenarioIndex,
  moduleTypeIndex,
  optimizationBudget
}: {
  readonly scenarioIndex: number
  readonly moduleTypeIndex: number
  readonly optimizationBudget: number
}): EffectDspRunPlan => ({
  _tag: "effect-dsp",
  scenarioId: (dspScenarios[scenarioIndex] ?? dspScenarios[0]!).id,
  moduleType: moduleTypeFromIndex(moduleTypeIndex),
  optimizationBudget
})
